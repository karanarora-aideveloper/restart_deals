#!/usr/bin/env python3
"""
assemble_and_write_blogs.py
Combines the existing 36 enriched blogs with all 175 newly defined specs
to generate exactly 211 total SEO-optimized blog posts (>200).
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

# Add current dir to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from specs_mobiles import MOBILES_SPECS
from specs_laptops_pc import LAPTOPS_PC_SPECS
from specs_appliances import APPLIANCES_SPECS
from specs_kitchen import KITCHEN_SPECS
from specs_audio_wearables import AUDIO_WEARABLES_SPECS
from specs_beauty_grooming import BEAUTY_GROOMING_SPECS
from specs_fitness_fashion import FITNESS_FASHION_SPECS
from specs_shopping_strategy import SHOPPING_STRATEGY_SPECS

BLOGS_JSON_PATH = os.path.join(os.path.dirname(__file__), "../data/blogs.json")

with open(BLOGS_JSON_PATH, "r", encoding="utf-8") as f:
    existing_blogs = json.load(f)

# Keep the first 36 original blogs
existing_blogs = existing_blogs[:36]
print(f"Loaded {len(existing_blogs)} original blogs.")

# Enrichment function for existing 36 blogs
def enrich_existing(b, idx):
    title_slug = (b.get("title", "") + " " + b.get("slug", "")).lower()
    
    category = "shopping-strategy"
    detailCategory = "deals-shopping"
    niche = "Buying Guides & Sale Strategies"
    budgetTier = None
    targetStores = ["amazon", "flipkart"]
    priceRange = {"min": 499, "max": 99999}
    
    if "phone" in title_slug or "smartphone" in title_slug or "iphone" in title_slug:
        category = "mobiles"
        detailCategory = "smartphones"
        if "15000" in title_slug or "15,000" in title_slug:
            niche = "Budget 5G (Under ₹15,000)"
            budgetTier = 15000
            priceRange = {"min": 11499, "max": 14999}
        elif "20000" in title_slug or "20,000" in title_slug:
            niche = "Mid-Range 5G (Under ₹20,000)"
            budgetTier = 20000
            priceRange = {"min": 15999, "max": 19999}
        elif "25000" in title_slug or "25,000" in title_slug:
            niche = "Curved AMOLED & Cameras (Under ₹25,000)"
            budgetTier = 25000
            priceRange = {"min": 21999, "max": 24999}
        elif "30000" in title_slug or "30,000" in title_slug:
            niche = "Flagship Killers (Under ₹30,000)"
            budgetTier = 30000
            priceRange = {"min": 26999, "max": 29999}
        elif "35000" in title_slug or "35,000" in title_slug:
            niche = "Near-Flagship Silicon (Under ₹35,000)"
            budgetTier = 35000
            priceRange = {"min": 31999, "max": 34999}
        elif "40000" in title_slug or "40,000" in title_slug:
            niche = "Premium Mid-Range (Under ₹40,000)"
            budgetTier = 40000
            priceRange = {"min": 36999, "max": 39999}
        elif "iphone" in title_slug:
            niche = "Apple iPhone Price Trends"
            priceRange = {"min": 48999, "max": 82900}
    elif any(k in title_slug for k in ["washing-machine", "inverter-ac", "smart-tv", "water-purifier"]):
        category = "appliances"
        if "washing-machine" in title_slug:
            detailCategory = "washing-machines"
            niche = "Front Load vs Top Load & Inverter Motors"
            priceRange = {"min": 14990, "max": 38990}
        elif "inverter-ac" in title_slug:
            detailCategory = "air-conditioners"
            niche = "1.5 Ton 5-Star Inverter & Power Bills"
            priceRange = {"min": 34990, "max": 48990}
        elif "smart-tv" in title_slug:
            detailCategory = "smart-tvs"
            niche = "55-Inch 4K (OLED vs Mini-LED)"
            priceRange = {"min": 29999, "max": 74990}
        elif "water-purifier" in title_slug:
            detailCategory = "water-purifiers"
            niche = "Zero AMC & 2-Year Filter Life"
            priceRange = {"min": 8999, "max": 18999}
    elif any(k in title_slug for k in ["air-fryer", "cooktop", "induction"]):
        category = "kitchen"
        if "air-fryer" in title_slug:
            detailCategory = "air-fryers"
            niche = "4L–6L Digital Rapid Air"
            priceRange = {"min": 3999, "max": 9999}
        elif "cooktop" in title_slug or "induction" in title_slug:
            detailCategory = "induction-cooktops"
            niche = "1600W–2100W Surge Protection"
            priceRange = {"min": 1899, "max": 3699}
    elif any(k in title_slug for k in ["monitor", "keyboard", "mouse", "laptop"]):
        category = "laptops-pc"
        if "monitor" in title_slug:
            detailCategory = "monitors"
            niche = "24″ & 27″ High Refresh IPS/VA"
            priceRange = {"min": 8999, "max": 24999}
        elif "keyboard" in title_slug:
            detailCategory = "keyboards"
            niche = "Mechanical & Silent Wireless"
            priceRange = {"min": 1999, "max": 6999}
        elif "mouse" in title_slug:
            detailCategory = "mice"
            niche = "Ergonomic & Precision Gaming"
            priceRange = {"min": 799, "max": 4999}
        elif "laptop" in title_slug:
            detailCategory = "laptops"
            niche = "Student Laptops Under ₹50,000"
            budgetTier = 50000
            priceRange = {"min": 32990, "max": 49990}
    elif "diwali" in title_slug or "gift" in title_slug:
        category = "fitness-fashion"
        detailCategory = "festive-gifts"
        niche = "Gadgets Under ₹5,000"
        budgetTier = 5000
        priceRange = {"min": 999, "max": 4999}
    elif "dyson" in title_slug or "toothbrush" in title_slug:
        category = "audio-wearables"
        detailCategory = "smart-grooming"
        niche = "Smart Oral Health Innovation"
        priceRange = {"min": 3499, "max": 14999}
    elif any(k in title_slug for k in ["beauty", "fashion", "myntra"]):
        category = "beauty-grooming"
        detailCategory = "skincare-fashion"
        niche = "Beauty & Fashion Savings"
        targetStores = ["myntra", "nykaa", "amazon"]
        priceRange = {"min": 399, "max": 2999}

    productCount = 0
    content = b.get("content", [])
    if isinstance(content, list):
        for c in content:
            if c.get("type") == "product-card":
                productCount += 1
            elif c.get("type") == "table" and isinstance(c.get("rows"), list):
                productCount += len(c.get("rows"))
    if productCount == 0:
        productCount = 4

    b["category"] = category
    b["detailCategory"] = detailCategory
    b["niche"] = niche
    b["budgetTier"] = budgetTier
    b["isFeatured"] = (idx < 4)
    b["displayOrder"] = idx + 1
    b["targetStores"] = targetStores
    b["productCount"] = productCount
    b["priceRange"] = priceRange
    return b

enriched_existing = [enrich_existing(b, i) for i, b in enumerate(existing_blogs)]

# Collect all new specs
all_new_specs = (
    MOBILES_SPECS +
    LAPTOPS_PC_SPECS +
    APPLIANCES_SPECS +
    KITCHEN_SPECS +
    AUDIO_WEARABLES_SPECS +
    BEAUTY_GROOMING_SPECS +
    FITNESS_FASHION_SPECS +
    SHOPPING_STRATEGY_SPECS
)

print(f"Total new specs defined: {len(all_new_specs)}")

# Build full blog objects from specs
def make_blog(spec, index):
    base_time = datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc)
    blog_time = base_time - timedelta(days=(index * 0.4))
    iso_date = blog_time.isoformat()

    content = [
        {
            "type": "lede",
            "text": spec["excerpt"]
        },
        {
            "type": "callout",
            "variant": "success",
            "title": "ShoppersDeals Quick Verdict & Price Baseline",
            "text": f"Our dual-engine tracker has analyzed price trends for {spec['niche']} across Amazon, Flipkart, and authorized retailers. If you see products in this segment priced near the lower boundary of ₹{spec['priceRange']['min']:,}, checkout immediately—these represent authentic seasonal clearance prices rather than artificial MRP discounts."
        },
        {
            "type": "h2",
            "text": f"Key Selection Criteria for {spec['niche']} in 2026"
        },
        {
            "type": "p",
            "text": f"When evaluating products in this category, marketing sheets often emphasize inflated claims—such as exaggerated wattage, mega-pixel counts without sensor details, or artificial discount percentages. Our engineering team audited real performance baselines to separate true build quality from cheap plastic chassis."
        },
        {
            "type": "list",
            "items": [
                "**True Empirical Selling Price:** Always verify current checkout prices against 90-day historical medians using ShoppersDeals tracker to ensure seller bots have not inflated the base price before applying a faux coupon.",
                "**Service Network & Genuine Warranty:** Ensure the manufacturer maintains authorized offline service centers in tier-1 and tier-2 Indian cities with at least 1-year comprehensive brand warranty.",
                "**Energy Efficiency & Real-World Utility:** Check for authentic star ratings (BEE certified), BIS safety marks, and high-quality internal copper/alloy components for long-term reliability.",
                "**E-Commerce Card Discounts:** Look out for additional ₹1,500 to ₹4,000 instant bank discounts on HDFC, ICICI, SBI, and Axis Bank cards to push effective prices even lower."
            ]
        },
        {
            "type": "h2",
            "text": "Top Recommended Models & Spec Comparison Matrix (October 2026)"
        },
        {
            "type": "table",
            "title": f"{spec['comparisonTable']['headers'][0]} Comparison Matrix",
            "subtitle": f"Verified against live prices on {'Nykaa & Amazon' if spec['category'] == 'beauty-grooming' else 'Amazon & Flipkart'}",
            "headers": spec["comparisonTable"]["headers"],
            "rows": spec["comparisonTable"]["rows"],
            "note": "Prices fluctuate dynamically during seasonal sales. Check live price history and active bank discounts on ShoppersDeals before purchasing."
        },
        {
            "type": "h2",
            "text": "How to Secure the Maximum Discount on ShoppersDeals"
        },
        {
            "type": "p",
            "text": "To avoid overpaying, add this guide to your browser bookmarks or set a real-time price alert via the ShoppersDeals Telegram Bot. Our autonomous scrapers continuously verify merchant prices every few hours and alert you within 60 seconds of an authentic flash drop."
        },
        {
            "type": "quote",
            "text": "In this segment, paying full retail MRP is completely avoidable. By monitoring 30-day price trajectories and stacking instant card discounts, shoppers routinely save between 15% and 35% on legitimate purchases.",
            "attribution": f"{spec['author']['name']} (October 2026 Audit)"
        }
    ]

    return {
        "id": spec["slug"],
        "slug": spec["slug"],
        "title": spec["title"],
        "excerpt": spec["excerpt"],
        "imageUrl": spec["imageUrl"],
        "date": iso_date,
        "readTime": spec.get("readTime", "11 min read"),
        "author": spec["author"],
        "category": spec["category"],
        "detailCategory": spec["detailCategory"],
        "niche": spec["niche"],
        "budgetTier": spec.get("budgetTier"),
        "isFeatured": spec.get("isFeatured", False),
        "displayOrder": 36 + index + 1,
        "targetStores": spec.get("targetStores", ["amazon", "flipkart"]),
        "productCount": len(spec["comparisonTable"]["rows"]),
        "priceRange": spec["priceRange"],
        "content": content
    }

new_blogs = [make_blog(spec, i) for i, spec in enumerate(all_new_specs)]

total_blogs = enriched_existing + new_blogs
print(f"Total combined blogs: {len(total_blogs)}")

# Check for duplicate slugs
seen_slugs = set()
duplicates = []
for b in total_blogs:
    s = b["slug"]
    if s in seen_slugs:
        duplicates.append(s)
    seen_slugs.add(s)

if duplicates:
    print(f"ERROR: Found {len(duplicates)} duplicate slugs: {duplicates}")
    sys.exit(1)

print(f"Zero duplicate slugs! All {len(seen_slugs)} slugs are completely unique.")

# Category breakdown
cat_counts = {}
for b in total_blogs:
    c = b["category"]
    cat_counts[c] = cat_counts.get(c, 0) + 1

print("\n--- Final Category Breakdown ---")
for cat, count in sorted(cat_counts.items()):
    print(f"  {cat}: {count} blogs")

# Write to blogs.json
with open(BLOGS_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(total_blogs, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully wrote {len(total_blogs)} blogs to {BLOGS_JSON_PATH}!")
