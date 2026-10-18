#!/usr/bin/env python3
"""
build_full_blogs_dataset.py
Generates the comprehensive 211-blog dataset for ShoppersDeals.
"""

import json
import os
from datetime import datetime, timedelta, timezone

BLOGS_JSON_PATH = os.path.join(os.path.dirname(__file__), "../data/blogs.json")

with open(BLOGS_JSON_PATH, "r", encoding="utf-8") as f:
    existing_blogs = json.load(f)

# Keep first 36 blogs as the base
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

print("Prepared enriched existing base of 36 blogs.")
