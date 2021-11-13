import re
import json

f_dotabuff_html = open("dotabuff.html", "r", encoding="utf8")
image_urls = []
for line in f_dotabuff_html:
    image_urls += re.findall("\/assets\/heroes\/.{1,110}\.jpg", line)

f_ids = open("heroes-ids.txt", "r")

hero_id_objs = json.loads(f_ids.read())
name_to_id = {}
for hero_id_obj in hero_id_objs["heroes"]:
    name_to_id[hero_id_obj["name"]] = hero_id_obj["id"]

heroes_dict = {}
for url in image_urls:
    hero_name = re.search("\/assets\/heroes\/(.{1,23})-", url).group(1)
    heroes_dict[str(name_to_id[hero_name])] = {
        "id": name_to_id[hero_name],
        "name": hero_name,
        "image": "http://dotabuff.com" + url
    }
print(heroes_dict)
