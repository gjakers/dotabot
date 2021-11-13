import re
import json

f_dotabuff_html = open("dotabuff.html", "r", encoding="utf8")
image_urls = []
for line in f_dotabuff_html:
    image_urls += re.findall("\/assets\/heroes\/.{1,110}\.jpg", line)

f_ids = open("heroes-ids.txt", "r")

hero_id_objs = json.loads(f_ids.read())
name_to_obj = {}
for hero_id_obj in hero_id_objs["heroes"]:
    name_to_obj[hero_id_obj["name"]] = hero_id_obj

heroes_dict = {}
for url in image_urls:
    hero_name = re.search("\/assets\/heroes\/(.{1,23})-", url).group(1)
    hero_obj = name_to_obj[hero_name]
    heroes_dict[str(hero_obj["name"])] = {
        "id": hero_obj["id"],
        "name": hero_obj["localized-name"],
        "image": "http://dotabuff.com" + url
    }
print(heroes_dict)
