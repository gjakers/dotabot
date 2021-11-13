First we need to get the dotabuff webpage that we will scrape the hero images
from. In powershell, run:

`Invoke-Webrequest 'https://dotabuff.com/heroes' -OutFile '.\dotabuff.html'`

Then update hero_ids.txt with any new heroes.

Lastly, run the script with:

`python parse-heroes.py > hero-images.json`
