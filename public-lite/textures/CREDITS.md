# Texture credits and licences

Every file in this directory comes from a public-domain or CC BY 4.0 source. Nothing was taken from
the Space Engine game or from texture sites with unclear licences.

- **Public domain** = work of a U.S. government agency (NASA, USGS, NOAA) or NASA-funded mission
  imagery released under NASA's media usage guidelines. Credit is requested, not legally required;
  NASA material must not be used to imply NASA endorsement.
- **CC BY 4.0** = <https://creativecommons.org/licenses/by/4.0/>. The credit line given below must be
  shown clearly and visibly wherever the image is used (e.g. an in-app "Credits" screen), and
  modifications must be indicated. The "Changes" column records what was modified here.

All files were converted by the scripts in `scripts/textures/` (resize, re-encode; other changes as noted).

## Planets and moons

| File | Source | Author / agency (credit line) | Licence | Changes |
|---|---|---|---|---|
| `earth_color.jpg` | `8k_earth_daymap.jpg`, <https://www.solarsystemscope.com/textures/> (derived from NASA Blue Marble) | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `earth_clouds.jpg` | `8k_earth_clouds.jpg`, <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | converted to greyscale, re-encoded |
| `earth_night.jpg` | Black Marble 2016, `BlackMarble_2016_3km.jpg`, <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg> (NASA Earth Observatory, "Earth at Night" image record 144898) | NASA Earth Observatory / NASA's Goddard Space Flight Center (Suomi NPP VIIRS) | Public domain | downsized 13500x6750 -> 4096x2048 |
| `earth_height.png` | ETOPO 2022 60 arc-second global relief model (ice surface), fetched from NOAA ERDDAP <https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_60s.html> | NOAA National Centers for Environmental Information, ETOPO 2022 Global Relief Model | Public domain (NOAA; "may be used and redistributed for free") | area-averaged 21600x10800 -> 4096x2048, longitude rolled to -180..180, 16-bit packed into R,G |
| `moon_color.jpg` | CGI Moon Kit, `lroc_color_poles_8k.tif`, <https://svs.gsfc.nasa.gov/4720> | NASA's Scientific Visualization Studio (Ernie Wright); Lunar Reconnaissance Orbiter Camera team | Public domain | re-encoded as JPEG |
| `moon_height.png` | CGI Moon Kit, `ldem_16.tif` (LOLA displacement map, 16 px/deg, float km), <https://svs.gsfc.nasa.gov/4720> | NASA's Scientific Visualization Studio (Ernie Wright); LRO Lunar Orbiter Laser Altimeter team | Public domain | area-averaged 5760x2880 -> 4096x2048, km -> m, 16-bit packed into R,G |
| `mars_color.jpg` | `8k_mars.jpg`, <https://www.solarsystemscope.com/textures/> (derived from NASA Viking/MGS data) | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `mars_height.png` | MGS MOLA Mission Experiment Gridded Data Record, `megt90n000eb.img` (topography, 16 px/deg, 16-bit), <https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/> | NASA / JPL / GSFC MOLA Science Team (Smith et al.), NASA Planetary Data System Geosciences Node | Public domain | area-averaged 5760x2880 -> 4096x2048, rolled from 0..360 to -180..180, 16-bit packed into R,G |
| `mercury_color.jpg` | `8k_mercury.jpg`, <https://www.solarsystemscope.com/textures/> (derived from NASA MESSENGER data) | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | downsized to 4096x2048 |
| `venus_color.jpg` | `4k_venus_atmosphere.jpg`, <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `venus_surface.jpg` | `8k_venus_surface.jpg`, <https://www.solarsystemscope.com/textures/> (derived from NASA Magellan radar data) | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | downsized to 4096x2048 |
| `jupiter_color.jpg` | `8k_jupiter.jpg` (4096x2048), <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `saturn_color.jpg` | `8k_saturn.jpg` (4096x2048), <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `saturn_ring.png` | `8k_saturn_ring_alpha.png`, <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | downsized 8192x500 -> 4096x250 (alpha-correct) |
| `uranus_color.jpg` | `2k_uranus.jpg`, <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `neptune_color.jpg` | `2k_neptune.jpg`, <https://www.solarsystemscope.com/textures/> | Solar System Scope (solarsystemscope.com) | CC BY 4.0 | none (file copied) |
| `io_color.jpg` | Io Galileo SSI / Voyager Color Merged Global Mosaic 1 km, <https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif> | NASA / JPL / USGS Astrogeology Science Center | Public domain | downsized to 4096x2048 |
| `europa_color.jpg` | Europa Voyager - Galileo SSI Global Mosaic 500 m (greyscale), <https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif> | NASA / JPL / USGS Astrogeology Science Center | Public domain | downsized, rolled to 0 deg centre, small unimaged polar gaps (4.5%) smoothly filled |
| `ganymede_color.jpg` | Ganymede Voyager - Galileo SSI Global Color Mosaic 1.4 km, <https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif> | NASA / JPL / USGS Astrogeology Science Center | Public domain | downsized, rolled to 0 deg centre, small gaps (3.8%) smoothly filled |
| `callisto_color.jpg` | Callisto Voyager - Galileo SSI Global Mosaic 1 km (greyscale), <https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif> | NASA / JPL / USGS Astrogeology Science Center | Public domain | downsized, rolled to 0 deg centre, small gaps (4.2%) smoothly filled |
| `titan_color.jpg` | Titan Cassini ISS Global Mosaic 4 km (PIA19658, 938 nm, greyscale), <https://planetarymaps.usgs.gov/mosaic/Titan_ISS_P19658_Mosaic_Global_4km.tif> | NASA / JPL-Caltech / Space Science Institute / USGS | Public domain | downsized 4040x2020 -> 2048x1024, rolled to 0 deg centre |
| `enceladus_color.jpg` | Enceladus Cassini ISS Global Mosaic 100 m (high-pass filtered, greyscale), <https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_ISS_Global_Mosaic_100m_HPF.tif> | NASA / JPL-Caltech / Space Science Institute / USGS | Public domain | downsized, rolled to 0 deg centre, gaps (6%) filled, brightness raised / contrast reduced |
| `triton_color.jpg` | Triton Voyager 2 Color Mosaic 600 m, <https://planetarymaps.usgs.gov/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif> | NASA / JPL / USGS Astrogeology Science Center | Public domain | downsized to 2048x1024; the unimaged 39% of the globe is a synthetic smooth fill |

Solar System Scope states that its textures are "based on NASA elevation and imagery data" with
"gaps filled with fictional terrain"; the gas/ice-giant maps and the Venus atmosphere map are
artist-processed composites rather than direct mission mosaics.

## Sky

| File | Source | Author / agency (credit line) | Licence | Changes |
|---|---|---|---|---|
| `sky_milkyway.jpg` | Deep Star Maps 2020, `milkyway_2020_8k_gal.exr`, <https://svs.gsfc.nasa.gov/4851> | NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC. Constellation figures based on those developed for the IAU by Alan MacRobert of Sky and Telescope magazine (Roger Sinnott and Rick Fienberg). | Public domain | tone-mapped from linear float EXR to 8-bit sRGB JPEG |


## Additional changes for the lightweight build

The source credits and earlier processing above are retained from public/textures/.
All JPEG maps are resized to at most 2048 pixels wide with Lanczos filtering and
re-encoded as progressive JPEG, quality 82, with the original greyscale mode retained.
Height maps are decoded to metres, BOX-averaged to 1024x512 and packed back into
lossless R/G 16-bit PNG using the same minimum and maximum heights.
The Saturn ring is copied unchanged. Unused Pluto, star-map and galaxy images are omitted.
