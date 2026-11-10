# Privacy

- No accounts, no API keys, no analytics, no tracking, no ads.
- The Car Thing asks the phone for a coarse location. The app **rounds it to 0.01° (about 1 km)** before putting it in any request.
- What leaves the phone:
  - Rounded latitude and longitude to the National Weather Service (`api.weather.gov`) to get alerts and the rain outlook.
  - A station id to NOAA CO-OPS and a buoy id to NOAA NDBC. These identify a place near you, not you.
  - A User-Agent string naming the app and its GitHub page.
- The services you contact see the phone's internet address, as with any web request. This app does not control that.
- What is stored through bridgething's key-value store (on the phone side): your last location (already rounded to about 1 km), the station list, buoy list and each station's flood levels and datums (kept up to 30 days), which warning ids have been spoken, and the speech on/off setting. The latest readings are held in memory only and are gone when the app restarts. Nothing is stored by the author.
- The author receives nothing.
