# App Icons

## HOE ICONS GENEREREN:

### Optie 1: Online Tool (Makkelijkst)
1. Ga naar: https://www.pwabuilder.com/imageGenerator
2. Upload je logo (vierkant, minimaal 512x512px)
3. Download alle maten
4. Kopieer naar deze folder

### Optie 2: Handmatig met Photoshop/GIMP
Maak je logo in deze maten:
- icon-72.png (72x72)
- icon-96.png (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192)
- icon-384.png (384x384)
- icon-512.png (512x512)

### Optie 3: ImageMagick (Command line)
```bash
# Installeer ImageMagick
# Windows: choco install imagemagick
# Of download van: https://imagemagick.org/

# Plaats je logo.png (512x512) in deze folder
# Genereer alle maten:
magick logo.png -resize 72x72 icon-72.png
magick logo.png -resize 96x96 icon-96.png
magick logo.png -resize 128x128 icon-128.png
magick logo.png -resize 144x144 icon-144.png
magick logo.png -resize 152x152 icon-152.png
magick logo.png -resize 192x192 icon-192.png
magick logo.png -resize 384x384 icon-384.png
cp logo.png icon-512.png
```

## REQUIREMENTS:
- **Formaat:** PNG
- **Achtergrond:** Transparant OF vaste kleur
- **Vorm:** Vierkant
- **Design:** Simple en herkenbaar (denk aan klein formaat)

## TIP:
Voor nu kun je een tijdelijke icon maken met:
- Initialen van je bedrijf
- Effen kleur achtergrond
- Witte tekst

Later vervang je deze met je officiële logo.
