use serde::{Deserialize, Serialize};

const USER_AGENT: &str = "WhereDoIBelong/0.1 (https://github.com/AaronGrace978/Where-Do-I-belong)";

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GeoHit {
    pub name: String,
    pub display_name: String,
    pub lat: f64,
    pub lon: f64,
    pub kind: Option<String>,
    pub country: Option<String>,
    pub city: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlacePhoto {
    pub url: String,
    pub thumb: String,
    pub title: String,
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaceIntel {
    pub geo: Option<GeoHit>,
    pub wiki_title: Option<String>,
    pub wiki_extract: Option<String>,
    pub wiki_url: Option<String>,
    pub photos: Vec<PlacePhoto>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobPost {
    pub title: String,
    pub company: String,
    pub location: String,
    pub url: String,
    pub tags: Vec<String>,
    pub remote: bool,
    pub source: String,
}

#[tauri::command]
pub async fn reverse_geocode(lat: f64, lon: f64) -> Result<GeoHit, String> {
    let http = client()?;
    let url = format!(
        "https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=jsonv2&addressdetails=1&zoom=18&extratags=1"
    );
    let v: serde_json::Value = http
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(parse_nominatim(&v, lat, lon))
}

#[tauri::command]
pub async fn search_places(query: String) -> Result<Vec<GeoHit>, String> {
    let http = client()?;
    let url = format!(
        "https://nominatim.openstreetmap.org/search?q={}&format=jsonv2&addressdetails=1&limit=8",
        urlencoding(&query)
    );
    let arr: Vec<serde_json::Value> = http
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    Ok(arr
        .iter()
        .map(|v| {
            let lat = v.get("lat").and_then(|x| x.as_str()).unwrap_or("0").parse().unwrap_or(0.0);
            let lon = v.get("lon").and_then(|x| x.as_str()).unwrap_or("0").parse().unwrap_or(0.0);
            parse_nominatim(v, lat, lon)
        })
        .collect())
}

#[tauri::command]
pub async fn place_intel(lat: f64, lon: f64) -> Result<PlaceIntel, String> {
    let geo = reverse_geocode(lat, lon).await.ok();
    let http = client()?;
    let wiki_url = format!(
        "https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={lat}|{lon}&gsradius=12000&gslimit=6&format=json"
    );
    let wiki: serde_json::Value = http
        .get(&wiki_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let hits = wiki
        .pointer("/query/geosearch")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();

    let mut wiki_title = None;
    let mut wiki_extract = None;
    let mut wiki_page_url = None;
    let mut page_ids: Vec<String> = Vec::new();
    for hit in &hits {
        if let Some(id) = hit.get("pageid").and_then(|x| x.as_u64()) {
            page_ids.push(id.to_string());
        }
        if wiki_title.is_none() {
            wiki_title = hit.get("title").and_then(|x| x.as_str()).map(|s| s.to_string());
        }
    }

    if !page_ids.is_empty() {
        let ids = page_ids.join("|");
        let detail_url = format!(
            "https://en.wikipedia.org/w/api.php?action=query&pageids={ids}&prop=extracts|info|pageimages&exintro=1&explaintext=1&inprop=url&pithumbsize=900&format=json"
        );
        if let Ok(detail) = http.get(&detail_url).send().await {
            if let Ok(dv) = detail.json::<serde_json::Value>().await {
                if let Some(pages) = dv.pointer("/query/pages").and_then(|x| x.as_object()) {
                    for page in pages.values() {
                        if wiki_extract.is_none() {
                            wiki_extract = page.get("extract").and_then(|x| x.as_str()).map(|s| s.to_string());
                            wiki_page_url = page.get("fullurl").and_then(|x| x.as_str()).map(|s| s.to_string());
                            if wiki_title.is_none() {
                                wiki_title = page.get("title").and_then(|x| x.as_str()).map(|s| s.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    let mut photos = vec![];
    let commons_url = format!(
        "https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord={lat}|{lon}&ggsradius=8000&ggslimit=14&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json"
    );
    if let Ok(res) = http.get(&commons_url).send().await {
        if let Ok(cv) = res.json::<serde_json::Value>().await {
            if let Some(pages) = cv.pointer("/query/pages").and_then(|x| x.as_object()) {
                for page in pages.values() {
                    let title = page
                        .get("title")
                        .and_then(|x| x.as_str())
                        .unwrap_or("Place")
                        .replace("File:", "");
                    if let Some(info) = page.get("imageinfo").and_then(|x| x.as_array()).and_then(|a| a.first()) {
                        let url = info.get("url").and_then(|x| x.as_str()).unwrap_or("").to_string();
                        let thumb = info
                            .get("thumburl")
                            .and_then(|x| x.as_str())
                            .unwrap_or(&url)
                            .to_string();
                        if url.is_empty() {
                            continue;
                        }
                        let lower = title.to_lowercase();
                        if lower.contains("map") || lower.contains("svg") || lower.contains("logo") {
                            continue;
                        }
                        photos.push(PlacePhoto {
                            url,
                            thumb,
                            title,
                            source: "Wikimedia Commons".into(),
                        });
                    }
                }
            }
        }
    }

    Ok(PlaceIntel {
        geo,
        wiki_title,
        wiki_extract,
        wiki_url: wiki_page_url,
        photos,
    })
}

#[tauri::command]
pub async fn search_jobs(location: String, query: Option<String>) -> Result<Vec<JobPost>, String> {
    let http = client()?;
    let loc = location.to_lowercase();
    let q = query.unwrap_or_default().to_lowercase();
    let mut jobs: Vec<JobPost> = Vec::new();

    if let Ok(res) = http.get("https://www.arbeitnow.com/api/job-board-api").send().await {
        if let Ok(v) = res.json::<serde_json::Value>().await {
            if let Some(data) = v.get("data").and_then(|x| x.as_array()) {
                for row in data {
                    let title = row.get("title").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let company = row
                        .get("company_name")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let location_s = row.get("location").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let url = row.get("url").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let blob = format!("{title} {company} {location_s}").to_lowercase();
                    if (!loc.is_empty() && blob.contains(&loc))
                        || (!q.is_empty() && blob.contains(&q))
                        || loc.is_empty()
                    {
                        jobs.push(JobPost {
                            title,
                            company,
                            location: location_s,
                            url,
                            tags: row
                                .get("tags")
                                .and_then(|x| x.as_array())
                                .map(|a| {
                                    a.iter()
                                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                                .unwrap_or_default(),
                            remote: row.get("remote").and_then(|x| x.as_bool()).unwrap_or(false),
                            source: "Arbeitnow".into(),
                        });
                    }
                    if jobs.len() >= 18 {
                        break;
                    }
                }
            }
        }
    }

    if jobs.len() < 8 {
        if let Ok(res) = http
            .get("https://remoteok.com/api")
            .header("Accept", "application/json")
            .send()
            .await
        {
            if let Ok(arr) = res.json::<Vec<serde_json::Value>>().await {
                for row in arr.iter().skip(1) {
                    let title = row.get("position").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let company = row.get("company").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let location_s = row.get("location").and_then(|x| x.as_str()).unwrap_or("Remote").to_string();
                    let url = row
                        .get("url")
                        .or_else(|| row.get("apply_url"))
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let blob = format!("{title} {company} {location_s}").to_lowercase();
                    if q.is_empty() || blob.contains(&q) || loc.is_empty() || blob.contains(&loc) {
                        jobs.push(JobPost {
                            title,
                            company,
                            location: location_s,
                            url,
                            tags: row
                                .get("tags")
                                .and_then(|x| x.as_array())
                                .map(|a| {
                                    a.iter()
                                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                                .unwrap_or_default(),
                            remote: true,
                            source: "RemoteOK".into(),
                        });
                    }
                    if jobs.len() >= 24 {
                        break;
                    }
                }
            }
        }
    }

    Ok(jobs)
}

fn parse_nominatim(v: &serde_json::Value, lat: f64, lon: f64) -> GeoHit {
    let address = v.get("address").cloned().unwrap_or(serde_json::json!({}));
    let city = address
        .get("city")
        .or_else(|| address.get("town"))
        .or_else(|| address.get("village"))
        .or_else(|| address.get("hamlet"))
        .or_else(|| address.get("suburb"))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let country = address
        .get("country")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());
    let name = v
        .get("name")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| city.clone())
        .unwrap_or_else(|| "This place".into());
    GeoHit {
        name,
        display_name: v
            .get("display_name")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .to_string(),
        lat,
        lon,
        kind: v
            .get("type")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        country,
        city,
    }
}

fn urlencoding(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push_str("%20"),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
