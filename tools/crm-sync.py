#!/usr/bin/env python3
"""Website update from the Lake & Land CRM ("Update website" button).

Two steps, run by the hourly scheduled task:
  python3 tools/crm-sync.py plan  <crm_inventory_dir>
      -> prints JSON: what will change, and which photo asset ids must be downloaded first
  python3 tools/crm-sync.py apply <crm_inventory_dir> <photo_dir>
      -> edits inventory.json (and writes photos for new units), prints the result JSON

<crm_inventory_dir> holds one JSON file per CRM inventory doc (ArtifactData read with out_dir).
<photo_dir> holds downloaded CRM photo assets named <asset id>.<ext>.

Rules
  CRM sold                      -> website status "Sold" (page, feed and lot hide it; the record stays)
  CRM pending / on hold         -> "Sale Pending"
  CRM in transit                -> "In Transit"
  CRM in stock                  -> "In Stock"
  CRM price changed             -> website price (and the "Price: $X + tax." line in the description)
  CRM "ready for website", not on the site and not sold -> added as a new unit with its photos
Nothing else on the site is touched. Run tools/build-feed.js and tools/build-units.js after apply.
"""
import glob, hashlib, json, os, re, sys, datetime as dt

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = ["front", "rear", "left", "right", "tongue", "vin", "deck", "ramp", "axle", "lights", "rails", "feature"]
STATUS = {"sold": "Sold", "pending": "Sale Pending", "hold": "Sale Pending", "in-transit": "In Transit", "in-stock": "In Stock"}


def load_crm(d):
    out = {}
    for f in glob.glob(os.path.join(d, "**", "*.json"), recursive=True):
        try:
            x = json.load(open(f))
        except Exception:
            continue
        u = x.get("data", x)
        if isinstance(u, dict) and u.get("stock"):
            out[str(u["stock"]).upper()] = u
    return out


def gal_ids(u):  # same order the CRM uses: angles first (VIN sticker left out), then gallery photos
    if isinstance(u.get("gallery"), list):
        return [x for x in u["gallery"] if x]
    shots = u.get("shots") or {}
    ids = [shots[k] for k in SHOTS if k != "vin" and shots.get(k)]
    for p in u.get("photos") or []:
        if (not p.get("type") or str(p.get("type")).startswith("image")) and p.get("name") != "Tongue sticker":
            ids.append(p["id"])
    seen, out = set(), []
    for i in ids:
        if i not in seen:
            seen.add(i); out.append(i)
    return out


def money(n): return "${:,.0f}".format(n)
def num(x):
    try: return float(str(x).replace("$", "").replace(",", ""))
    except Exception: return 0.0
def lb(s):
    m = re.search(r"([\d,]+)\s*LB", str(s or ""), re.I)
    return int(m.group(1).replace(",", "")) if m else None
def clean_title(t):
    t = re.sub(r",?\s*Owen WI$", "", t or "").strip()
    return re.sub(r"^New\s+", "", t)


def plan(crm, site):
    on_site = {str(u.get("stock", "")).upper(): u for u in site["units"]}
    ch = {"status": [], "price": [], "add": [], "skipped": []}
    for st, s in on_site.items():
        c = crm.get(st)
        if not c:
            continue
        want = STATUS.get(c.get("status") or "in-stock", "In Stock")
        if want != s.get("status"):
            ch["status"].append({"stock": st, "from": s.get("status"), "to": want})
        p = int(num(c.get("price")))
        if p and p != int(s.get("priceNum") or num(s.get("price"))) and want != "Sold":
            ch["price"].append({"stock": st, "from": s.get("price"), "to": money(p)})
    for st, c in crm.items():
        if st in on_site or c.get("web") != "ready" or c.get("status") == "sold":
            continue
        ids = gal_ids(c)
        if not c.get("price") or len(ids) < 3 or not c.get("desc"):
            ch["skipped"].append({"stock": st, "why": "needs a price, a description and at least 3 photos"})
            continue
        ch["add"].append({"stock": st, "photos": ids})
    need = sorted({i for a in ch["add"] for i in a["photos"]})
    return ch, need


def new_unit(st, c, photo_dir):
    from PIL import Image, ImageOps
    os.makedirs(os.path.join(REPO, "photos/thumbs"), exist_ok=True)
    photos, seen = [], set()
    for i, aid in enumerate(gal_ids(c)):
        src = next(iter(glob.glob(os.path.join(photo_dir, aid + ".*"))), None)
        if not src:
            continue
        h = hashlib.sha256(open(src, "rb").read()).hexdigest()
        if h in seen:
            continue
        seen.add(h)
        rel = f"photos/{st.lower()}-{len(photos) + 1}.jpg"
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((1400, 1400), Image.LANCZOS)
        im.save(os.path.join(REPO, rel), "JPEG", quality=72, optimize=True, progressive=True)
        im.thumbnail((480, 480), Image.LANCZOS)
        im.save(os.path.join(REPO, rel.replace("photos/", "photos/thumbs/")), "JPEG", quality=70, optimize=True, progressive=True)
        photos.append(rel)
    desc = c["desc"].strip()
    intro = [p.strip() for p in desc.split("\n\n") if p.strip()][0]
    m = re.search(r"was \$([\d,]+)", desc)
    was = int(m.group(1).replace(",", "")) if m else None
    price = int(num(c["price"]))
    g, ga = lb(c.get("gvwr")), lb(c.get("gawr"))
    w, l = c.get("width"), c.get("length")
    size = f"{w}x{l}" if w and l else ""
    cat = c.get("type") or "trailer"
    if cat not in ("trailer", "pontoon-trailer", "pontoon"):
        cat = "trailer"
    chips = [x for x in [size.replace("x", " x ") + " ft" if size else "", c.get("axleCount") or "", f"{g:,} lb GVWR" if g else "", c.get("ramp") or "", c.get("sides") or ""] if x]
    specs = [["Year", str(c.get("year", ""))], ["Brand", "Trophy Trailers"]]
    if size: specs.append(["Size", size.replace("x", " x ") + " ft"])
    if c.get("axleCount"): specs.append(["Axles", c["axleCount"]])
    if g: specs.append(["GVWR", f"{g:,} lb"])
    if ga: specs.append(["GAWR", f"{ga:,} lb per axle"])
    for k, lab in [("deck", "Deck"), ("sides", "Sides"), ("ramp", "Ramp"), ("tires", "Tires"), ("rims", "Rims")]:
        if c.get(k): specs.append([lab, c[k]])
    specs.append(["Built by", "Trinity Products, USA"])
    full = clean_title(c.get("fbTitle") or c.get("title") or st)
    return {
        "id": st, "stock": st, "category": cat, "model": re.sub(r"^\d{4}\s+Trophy\s+", "", full), "fullName": full,
        "year": str(c.get("year", "")), "price": money(price), "priceNum": price, "wasPrice": money(was) if was else "",
        "status": STATUS.get(c.get("status") or "in-stock", "In Stock"), "condition": "Used" if c.get("condition") == "used" else "New",
        "vin": c.get("vin", "") if cat != "pontoon" else "", "slug": st.lower(), "tag": "Clearance" if was or c.get("clearance") else "",
        "qty": int(c.get("qty") or 1), "size": size, "gvwr": g or 0, "intro": intro, "desc": desc, "chips": chips, "specs": specs,
        "seoTitle": full + " | Lake & Land Rec, Owen WI", "seoDesc": (intro.rstrip(".") + ". " + money(price) + " + tax. Call or text 715-797-4782.")[:300],
        "photos": photos, "thumbs": [p.replace("photos/", "photos/thumbs/") for p in photos],
    }


def apply(crm, site, ch, photo_dir):
    by = {str(u.get("stock", "")).upper(): u for u in site["units"]}
    for x in ch["status"]:
        by[x["stock"]]["status"] = x["to"]
    for x in ch["price"]:
        u = by[x["stock"]]; p = int(num(x["to"]))
        u["price"], u["priceNum"] = money(p), p
        u["desc"] = re.sub(r"Price: \$[\d,]+ \+ tax\.", f"Price: {money(p)} + tax.", u.get("desc", ""))
        u["seoDesc"] = re.sub(r"\$[\d,]+ \+ tax", f"{money(p)} + tax", u.get("seoDesc", ""))
    added = []
    for a in ch["add"]:
        u = new_unit(a["stock"], crm[a["stock"]], photo_dir)
        if len(u["photos"]) >= 3:
            site["units"].append(u); added.append(a["stock"])
        else:
            ch["skipped"].append({"stock": a["stock"], "why": "photos could not be downloaded"})
    ch["added"] = added
    site["updated"] = dt.date.today().isoformat()
    json.dump(site, open(os.path.join(REPO, "inventory.json"), "w"), indent=1, ensure_ascii=False)
    return ch


if __name__ == "__main__":
    mode, d = sys.argv[1], sys.argv[2]
    crm = load_crm(d)
    site = json.load(open(os.path.join(REPO, "inventory.json")))
    ch, need = plan(crm, site)
    if mode == "plan":
        print(json.dumps({"changes": ch, "need_assets": need, "crm_units": len(crm)}, indent=1))
    else:
        print(json.dumps(apply(crm, site, ch, sys.argv[3] if len(sys.argv) > 3 else ""), indent=1))
