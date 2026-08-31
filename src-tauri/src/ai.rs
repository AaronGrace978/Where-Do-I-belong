use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

const USER_AGENT: &str = "WhereDoIBelong/0.1 (https://github.com/AaronGrace978/Where-Do-I-belong)";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub api_key: String,
    pub system: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunk {
    pub kind: String,
    pub text: Option<String>,
    pub tool: Option<serde_json::Value>,
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())
}

pub async fn chat_stream(request: ChatRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    match request.provider.as_str() {
        "ollama" => stream_ollama(request, on_chunk).await,
        "openai" => stream_openai_compat(
            request,
            on_chunk,
            "https://api.openai.com/v1/chat/completions",
            false,
        )
        .await,
        "openrouter" => stream_openai_compat(
            request,
            on_chunk,
            "https://openrouter.ai/api/v1/chat/completions",
            true,
        )
        .await,
        "anthropic" => stream_anthropic(request, on_chunk).await,
        other => Err(format!("Unknown provider: {other}")),
    }
}

fn tools_openai() -> serde_json::Value {
    serde_json::json!([
        {
            "type": "function",
            "function": {
                "name": "fly_to_place",
                "description": "Fly the globe to a place and drop a pin. Use this whenever you recommend a city or the user asks about a location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "lat": { "type": "number" },
                        "lon": { "type": "number" },
                        "reason": { "type": "string" }
                    },
                    "required": ["name", "lat", "lon"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "highlight_archetype",
                "description": "Light up every known city that matches a people-climate.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "archetype": {
                            "type": "string",
                            "enum": ["unique","manipulator","highTrust","hustle","quiet","queer","intellectual","traditional","luxury","creative","tech","diaspora"]
                        }
                    },
                    "required": ["archetype"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "recommend_matches",
                "description": "Pin the best belonging matches for this user on the globe.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "cityIds": { "type": "array", "items": { "type": "string" } }
                    },
                    "required": ["cityIds"]
                }
            }
        }
    ])
}

fn tools_anthropic() -> serde_json::Value {
    serde_json::json!([
        {
            "name": "fly_to_place",
            "description": "Fly the globe to a place and drop a pin.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": { "type": "string" },
                    "lat": { "type": "number" },
                    "lon": { "type": "number" },
                    "reason": { "type": "string" }
                },
                "required": ["name", "lat", "lon"]
            }
        },
        {
            "name": "highlight_archetype",
            "description": "Light up every known city that matches a people-climate.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "archetype": { "type": "string" }
                },
                "required": ["archetype"]
            }
        },
        {
            "name": "recommend_matches",
            "description": "Pin the best belonging matches for this user on the globe.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "cityIds": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["cityIds"]
            }
        }
    ])
}

async fn emit(on_chunk: &Channel<StreamChunk>, chunk: StreamChunk) -> Result<(), String> {
    on_chunk.send(chunk).map_err(|e| e.to_string())
}

async fn stream_ollama(request: ChatRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    let mut messages = vec![serde_json::json!({
        "role": "system",
        "content": request.system
    })];
    for m in &request.messages {
        messages.push(serde_json::json!({
            "role": m.role,
            "content": m.content
        }));
    }

    let http = client()?;
    let res = http
        .post("https://ollama.com/api/chat")
        .bearer_auth(&request.api_key)
        .json(&serde_json::json!({
            "model": request.model,
            "messages": messages,
            "stream": true,
            "tools": tools_openai()
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Ollama Cloud {status}: {body}"));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(content) = v.pointer("/message/content").and_then(|x| x.as_str()) {
                    if !content.is_empty() {
                        emit(
                            &on_chunk,
                            StreamChunk {
                                kind: "token".into(),
                                text: Some(content.to_string()),
                                tool: None,
                            },
                        )
                        .await?;
                    }
                }
                if let Some(tool_calls) = v.pointer("/message/tool_calls").and_then(|x| x.as_array()) {
                    for call in tool_calls {
                        emit(
                            &on_chunk,
                            StreamChunk {
                                kind: "tool".into(),
                                text: None,
                                tool: Some(normalize_openai_tool(call)),
                            },
                        )
                        .await?;
                    }
                }
            }
        }
    }
    emit(
        &on_chunk,
        StreamChunk {
            kind: "done".into(),
            text: None,
            tool: None,
        },
    )
    .await
}

async fn stream_openai_compat(
    request: ChatRequest,
    on_chunk: Channel<StreamChunk>,
    url: &str,
    openrouter: bool,
) -> Result<(), String> {
    let mut messages = vec![serde_json::json!({
        "role": "system",
        "content": request.system
    })];
    for m in &request.messages {
        messages.push(serde_json::json!({
            "role": m.role,
            "content": m.content
        }));
    }

    let http = client()?;
    let mut req = http
        .post(url)
        .bearer_auth(&request.api_key)
        .json(&serde_json::json!({
            "model": request.model,
            "messages": messages,
            "stream": true,
            "tools": tools_openai()
        }));

    if openrouter {
        req = req
            .header("HTTP-Referer", "https://github.com/AaronGrace978/Where-Do-I-belong")
            .header("X-Title", "Where Do I Belong");
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Provider {status}: {body}"));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut tool_name = String::new();
    let mut tool_args = String::new();

    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();
            if line.is_empty() {
                continue;
            }
            let payload = line.strip_prefix("data: ").unwrap_or(&line);
            if payload == "[DONE]" {
                continue;
            }
            let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) else {
                continue;
            };
            if let Some(content) = v
                .pointer("/choices/0/delta/content")
                .and_then(|x| x.as_str())
            {
                if !content.is_empty() {
                    emit(
                        &on_chunk,
                        StreamChunk {
                            kind: "token".into(),
                            text: Some(content.to_string()),
                            tool: None,
                        },
                    )
                    .await?;
                }
            }
            if let Some(calls) = v
                .pointer("/choices/0/delta/tool_calls")
                .and_then(|x| x.as_array())
            {
                for call in calls {
                    if let Some(name) = call.pointer("/function/name").and_then(|x| x.as_str()) {
                        if !name.is_empty() {
                            tool_name = name.to_string();
                        }
                    }
                    if let Some(args) = call.pointer("/function/arguments").and_then(|x| x.as_str()) {
                        tool_args.push_str(args);
                    }
                }
            }
        }
    }

    if !tool_name.is_empty() {
        let args: serde_json::Value =
            serde_json::from_str(&tool_args).unwrap_or(serde_json::json!({}));
        emit(
            &on_chunk,
            StreamChunk {
                kind: "tool".into(),
                text: None,
                tool: Some(serde_json::json!({ "name": tool_name, "arguments": args })),
            },
        )
        .await?;
    }

    emit(
        &on_chunk,
        StreamChunk {
            kind: "done".into(),
            text: None,
            tool: None,
        },
    )
    .await
}

async fn stream_anthropic(request: ChatRequest, on_chunk: Channel<StreamChunk>) -> Result<(), String> {
    let messages: Vec<serde_json::Value> = request
        .messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": if m.role == "assistant" { "assistant" } else { "user" },
                "content": m.content
            })
        })
        .collect();

    let http = client()?;
    let res = http
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &request.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&serde_json::json!({
            "model": request.model,
            "max_tokens": 4096,
            "system": request.system,
            "messages": messages,
            "stream": true,
            "tools": tools_anthropic()
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic {status}: {body}"));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();
    let mut tool_name = String::new();
    let mut tool_json = String::new();

    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));
        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();
            let Some(payload) = line.strip_prefix("data: ") else {
                continue;
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(payload) else {
                continue;
            };
            let event = v.get("type").and_then(|x| x.as_str()).unwrap_or("");
            match event {
                "content_block_delta" => {
                    if let Some(text) = v.pointer("/delta/text").and_then(|x| x.as_str()) {
                        emit(
                            &on_chunk,
                            StreamChunk {
                                kind: "token".into(),
                                text: Some(text.to_string()),
                                tool: None,
                            },
                        )
                        .await?;
                    }
                    if let Some(partial) = v.pointer("/delta/partial_json").and_then(|x| x.as_str()) {
                        tool_json.push_str(partial);
                    }
                }
                "content_block_start" => {
                    if v.pointer("/content_block/type").and_then(|x| x.as_str()) == Some("tool_use") {
                        tool_name = v
                            .pointer("/content_block/name")
                            .and_then(|x| x.as_str())
                            .unwrap_or("")
                            .to_string();
                    }
                }
                _ => {}
            }
        }
    }

    if !tool_name.is_empty() {
        let args: serde_json::Value =
            serde_json::from_str(&tool_json).unwrap_or(serde_json::json!({}));
        emit(
            &on_chunk,
            StreamChunk {
                kind: "tool".into(),
                text: None,
                tool: Some(serde_json::json!({ "name": tool_name, "arguments": args })),
            },
        )
        .await?;
    }

    emit(
        &on_chunk,
        StreamChunk {
            kind: "done".into(),
            text: None,
            tool: None,
        },
    )
    .await
}

fn normalize_openai_tool(call: &serde_json::Value) -> serde_json::Value {
    let name = call
        .pointer("/function/name")
        .or_else(|| call.get("name"))
        .and_then(|x| x.as_str())
        .unwrap_or("");
    let args = call
        .pointer("/function/arguments")
        .cloned()
        .or_else(|| call.get("arguments").cloned())
        .unwrap_or(serde_json::json!({}));
    let args = match args {
        serde_json::Value::String(s) => serde_json::from_str(&s).unwrap_or(serde_json::json!({})),
        other => other,
    };
    serde_json::json!({ "name": name, "arguments": args })
}
