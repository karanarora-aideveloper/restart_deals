/**
 * Category Classifier Engine for ShoppersDeals
 * High-precision taxonomy classifier mapping e-commerce product titles, merchants,
 * and category hints into the canonical 14 departments and granular subcategories.
 */

export function classifyProduct(title, merchant = '', categoryHint = '') {
  const t = (title || '').trim();
  const lowerTitle = t.toLowerCase();
  const lowerHint = (categoryHint || '').toLowerCase();
  const combined = `${lowerHint} ${lowerTitle}`.trim();

  // 1. PETS (high priority so dog treats, cat purée, pet leashes don't land in grocery/toys)
  if (
    /\b(dog|cat|puppy|kitten|pets?)\b/i.test(combined) &&
    /\b(treats?|chew|food|litter|kibble|leash|collar|dog rope|toy for dog|cat toy|churu|pur[eé]e|dematting|detangler|pet grooming|aquarium|fish food|bird food|pee\s*pads?|training\s*pads?|potty|dog\s*bed|cat\s*tree|scratching\s*post)\b/i.test(combined)
  ) {
    return { category: 'pets', subcategory: 'pet-supplies' };
  }

  // 2. PERSONAL CARE - FEMININE HYGIENE
  if (
    /\b(sanitary\s*(?:pads?|napkins?)|period\s*pant(?:y|ies)|tampons?|menstrual\s*cups?|panty\s*liners?|breast\s*pads?|bra\s*liners?|whisper|stayfree|sofy|kotex)\b/i.test(combined)
  ) {
    return { category: 'personal-care', subcategory: 'feminine-hygiene' };
  }

  // 3. PERSONAL CARE - ORAL CARE & WELLNESS
  if (/\b(toothpaste|toothbrush|oral-b|mouthwash|floss|foam dressing|silicone adhesive bandages?|band-aid|first aid)\b/i.test(combined)) {
    return { category: 'personal-care', subcategory: 'oral-care' };
  }
  if (
    /\b(heating\s*pad|menstrual\s*cramps?\s*relief|hot\s*water\s*bag|blood\s*pressure\s*monitor|bp\s*monitor|weighing\s*scale|weight\s*machine|massager|glucometer|pulse\s*oximeter|thermometer)\b/i.test(combined)
  ) {
    return { category: 'personal-care', subcategory: 'wellness' };
  }

  // 4. BABY & KIDS
  if (/\b(diapers?|napp(?:y|ies)|baby\s*wipes?|swim\s*diaper|mamy\s*poko|huggies|pampers)\b/i.test(combined)) {
    return { category: 'baby-kids', subcategory: 'diapers-wipes' };
  }
  if (/\b(stroller|pram|baby\s*carrier|baby\s*walker|tricycle|trike|convertible\s*car\s*seat|car\s*seat|baby\s*cot|baby\s*cradle|baby\s*swing|crib|bassinet|high\s*chair)\b/i.test(combined)) {
    return { category: 'baby-kids', subcategory: 'baby-gear' };
  }
  if (/\b(feeding\s*bottle|sipper|nursing\s*cover|breast\s*pump|teether|baby\s*pacifier|baby\s*food\s*feeder)\b/i.test(combined)) {
    return { category: 'baby-kids', subcategory: 'feeding-nursing' };
  }
  if (
    /\b(baby\s*toy|kids?\s*toy|infant\s*toy|toddler\s*toy|lego|barbie|nerf|board\s*game|building\s*blocks?|rattle|action\s*figure|soft\s*toy|teddy\s*bear|pretend\s*play|kitchen\s*set\s*for\s*kids|toys?\s*kitchen\s*set)\b/i.test(combined) ||
    (/\btoys?\b/i.test(combined) && /\b(kids?|girls?|boys?|children)\b/i.test(combined) && !/\b(sex|adult)\b/i.test(combined)) ||
    (/\b(jigsaw\s*puzzle|puzzle\s*cube)\b/i.test(combined) && !/\bfor adults\b/i.test(combined))
  ) {
    return { category: 'baby-kids', subcategory: 'toys-games' };
  }

  // 5. TRAVEL - LUGGAGE & BAGS
  if (
    /\b(trolley\s*bags?|suitcases?|luggage|spinner\s*wheels?|cabin\s*(?:luggage|bag|size)|check-in\s*(?:luggage|suitcase)|hard\s*case\s*(?:trolley|luggage)|hard\s*trolley|duffle\s*bags?|duffel\s*bags?|travel\s*duffle|samsonite|american\s*tourister|safari|vip|kamiliant|aristocrat|mokobara|skybags)\b/i.test(combined) &&
    !/\b(?:luggage|suitcase)\s+(?:scale|strap|tag|cover|cable|lock|organizer)\b/i.test(combined)
  ) {
    return { category: 'travel', subcategory: 'luggage' };
  }
  if (
    /\b(backpacks?|daypacks?|rucksacks?|laptop\s*bags?|school\s*bags?|college\s*bags?|travel\s*bags?|handbags?|tote\s*bags?|sling\s*bags?|crossbody\s*bags?|messenger\s*bags?|wallets?|clutch(?:es)?|card\s*holder|passport\s*holder|packing\s*cubes?)\b/i.test(combined)
  ) {
    return { category: 'travel', subcategory: 'bags' };
  }

  // 6. CLEANING (Catch detergent, cleaner sprays before washing machines/kitchen appliances)
  if (
    /\b(liquid\s*detergent|washing\s*powder|detergent\s*bar|detergent\s*liquid|fabric\s*conditioner|comfort\s*after\s*wash|laundry\s*bag|shoe\s*washing\s*machine\s*bag|cleaner\s*spray|stain\s*remover|degreaser\s*spray|mop|broom|toilet\s*paper|garbage\s*bags?|trash\s*can|floor\s*cleaner)\b/i.test(combined)
  ) {
    return { category: 'home', subcategory: 'cleaning' };
  }

  // 7. APPLIANCES (Granular High-Ticket)
  if (/\b(refrigerator|fridge|single door|double door|side-by-side|frost free)\b/i.test(combined) && !/\b(magnet|cover|cleaner|stand|mat)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'refrigerators' };
  }
  if (
    /\b(washing\s*machine|washer\s*dryer|front\s*load|top\s*load|semi\s*automatic)\b/i.test(combined) &&
    !/\b(detergent|liquid|powder|bag|laundry\s*bag|cover|stand|mat|cleaner|descaler)\b/i.test(combined)
  ) {
    return { category: 'appliances', subcategory: 'washing-machines' };
  }
  if (/\b(air\s*conditioner|inverter\s*ac|split\s*ac|window\s*ac|\b1\.5\s*ton\b|\b1\s*ton\b|\b2\s*ton\b)\b/i.test(combined) && !/\b(cover|remote|bracket)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'air-conditioners' };
  }
  if (
    /\b(water\s*purifier|ro\s*\+\s*uv|ro\s*\+\s*uf|aquaguard|alkaline\s*purifier|livpure|kent\s*ro|reverse\s*osmosis\s*water\s*filter)\b/i.test(combined) &&
    !/\b(candle|bottle|filter\s*cartridge|replacement\s*filter)\b/i.test(combined)
  ) {
    return { category: 'appliances', subcategory: 'water-purifiers' };
  }
  if (/\b(air\s*purifier|dehumidifier|humidifier)\b/i.test(combined) && !/\b(filter\s*replacement|replacement\s*filter)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'air-purifiers' };
  }
  if (/\b(geyser|water\s*heater|instant\s*geyser|storage\s*water\s*heater)\b/i.test(combined) && !/\b(pipe|element|rod)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'geysers' };
  }
  if (/\b(air\s*fryer|digital\s*air\s*fryer)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'air-fryers' };
  }
  if (
    /\b(microwave|convection\s*microwave|grill\s*microwave|oven\s*toaster\s*grill(?:er)?|\botg\s*oven\b)\b/i.test(combined) &&
    !/\b(pendrive|flash\s*drive|type-c|usb)\b/i.test(combined)
  ) {
    return { category: 'appliances', subcategory: 'microwaves' };
  }
  if (/\b(kitchen\s*chimney|auto-clean\s*chimney|chimney\b)\b/i.test(combined) && !/\b(cleaner|spray|degreaser)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'chimneys' };
  }
  if (/\b(ceiling\s*fan|bldc\s*fan|pedestal\s*fan|table\s*fan|exhaust\s*fan|air\s*cooler|desert\s*cooler|tower\s*fan)\b/i.test(combined)) {
    return { category: 'appliances', subcategory: 'fans-coolers' };
  }
  if (
    /\b(mixer\s*grinder|juicer\s*mixer|induction\s*cooktop|induction\s*stove|electric\s*kettle|sandwich\s*maker|pop-up\s*toaster|hand\s*blender|food\s*processor|coffee\s*machine|espresso\s*maker)\b/i.test(combined)
  ) {
    return { category: 'appliances', subcategory: 'kitchen-appliances' };
  }

  // 8. ELECTRONICS
  // Mobiles: strictly smartphones and tablets
  if (
    (/\b(iphone\s*1[1-7]|galaxy\s*s2[0-6]|galaxy\s*m\d{2}|galaxy\s*a\d{2}|galaxy\s*(?:tab|pad|fold|flip|z\s*fold|z\s*flip)|pixel\s*\d+|redmi\s*note|realme|oneplus\s*(?:\d+[a-z]*|nord|n\d+[a-z]*)|poco\s*[a-z]\d+|iqoo|motorola\s*edge|smartphone|mobile\s*phone|5g\s*mobile|cell\s*phone|android\s*phone|ipad\s*(?:air|pro|mini)?|\btablets?\b|\btab\s*[as]\d+|nothing\s*phone|oppo\s*[ka]\d+|boltt\s*evo)\b/i.test(combined) ||
     /\(\d+\s*gb\s*ram\)/i.test(combined)) &&
    !/\b(back\s*cover|phone\s*case|phone\s*cover|tempered\s*glass|glass\s*protector|screen\s*protector|screen\s*guard|lens\s*protector|charging\s*cable|phone\s*holder|phone\s*stand|skin\s*wrap|pouch\s*case)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'mobiles' };
  }

  // Laptops & Computers: strictly laptops, notebooks, and all-in-one PCs
  if (
    /\b(macbook\s*(?:air|pro)|thinkpad|ideapad|vivobook|zenbook|rog\s*strix|tuf\s*gaming|pavilion|inspiron|laptop|notebook|chromebook|all\s*in\s*one\s*pc|\baio\s*pc\b|desktop\s*pc|mac\s*mini|mac\s*studio|imac)\b/i.test(combined) &&
    !/\b(bag|sleeve|case|cover|stand|adapter|charger|cable|mouse|keyboard|mousepad|cleaner|cleaning|skin|cooling\s*pad|desk)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'laptops' };
  }

  // Audio: Earbuds, TWS, headphones, neckbands, speakers, gaming headsets
  if (
    /\b(earbuds?|tws\b|headphones?|earphones?|neckbands?|bluetooth\s*speaker|\bspeaker\b|soundbar|airpods|headset|gaming\s*headset|wireless\s*headset|lightspeed\s*wireless)\b/i.test(combined) &&
    !/\b(case|cover|ear\s*tips|stand|power\s*banks?|powerbank)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'audio' };
  }

  // Wearables: Smartwatches, fitness trackers
  if (
    /\b(smartwatch(?:es)?|smart\s*watch|fitness\s*band|smart\s*band|smart\s*ring|apple\s*watch|galaxy\s*watch|redmi\s*watch|noise\s*watch|boat\s*(?:wave|storm|lunar|xtend)|fire-boltt)\b/i.test(combined) &&
    !/\b(only\s*strap|replacement\s*strap|strap\s*for\s*(?:smartwatch|boat|apple|galaxy)|watch\s*case|watch\s*cover|watch\s*screen\s*protector)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'wearables' };
  }

  // Smart TVs & Displays
  if (
    (/\b(television|projectors?|\bmonitors?\b|bravia)\b/i.test(combined) ||
     /\b(?:4k|ultra\s*hd|smart|oled|qled|mini\s*led|full\s*hd|hd\s*ready|android|google|fire|webos|led)\s*(?:[\w\s-]{0,25})\s*(?:tv|led|display)\b/i.test(combined) ||
     /\b\d{2,3}\s*(?:inch|inches|cm|cms)\b[^\n]{0,60}\b(?:tv|led|smart|google|android|4k|qled)\b/i.test(combined)) &&
    !/\b(mount|stand|wall\s*bracket|remote|cover|tuner|antenna|tv\s*stick|fire\s*tv\s*stick)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'tv' };
  }

  // Cameras & Photography
  if (/\b(dslr|mirrorless|action\s*cam|gopro|tripod|gimbal|camera\s*lens|security\s*camera|cctv|video\s*doorbell)\b/i.test(combined)) {
    return { category: 'electronics', subcategory: 'cameras' };
  }

  // Gaming
  if (/\b(playstation|ps5|ps4|xbox|nintendo|gamepad|game\s*controller|gaming\s*console)\b/i.test(combined)) {
    return { category: 'electronics', subcategory: 'gaming' };
  }

  // Electronics Accessories: Mice, keyboards, mouse pads, USB drives, chargers, cables, power banks
  if (
    /\b(power\s*station|portable\s*power|inverter\s*battery|solar\s*generator|mouse|keyboard|mouse\s*pad|desk\s*mat|pen\s*drive|flash\s*drive|pendrive|otg\s*(?:drive|pendrive|type-c)|ssd|hard\s*disk|power\s*bank|charger|charging\s*adapter|fast\s*charger|wall\s*charger|charging\s*cable|type-c\s*cable|usb\s*cable|hdmi\s*cable|tempered\s*glass|phone\s*case|back\s*cover|laptop\s*sleeve|adapter|surge\s*protector|extension\s*cord|barcode\s*scanner|airtag\s*holder|lifepo4|lithium\s*iron\s*phosphate|deep\s*cycle\s*battery)\b/i.test(combined)
  ) {
    return { category: 'electronics', subcategory: 'accessories' };
  }

  // 9. BEAUTY & GROOMING
  if (/\b(shampoo|conditioner|hair\s*oil|hair\s*serum|hair\s*mask|rosemary\s*water|keratin)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'haircare' };
  }
  if (/\b(face\s*wash|cleanser|face\s*serum|face\s*cream|moisturi[sz]er|sunscreen|toner|sheet\s*mask|micellar\s*water|brightening\s*(?:serum|cream|gel|lotion)|niacinamide|salicylic|hyaluronic|retinol|vitamin\s*c|cetaphil|cerave|minimalist|derma\s*co|dot\s*&\s*key|aqualogica|plum\s*goodness|biotique|mamaearth)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'skincare' };
  }
  if (/\b(lipstick|lip\s*gloss|lip\s*balm|lip\s*tint|foundation|concealer|compact\s*powder|kajal|mascara|eyeliner|eyeshadow|blush|makeup)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'makeup' };
  }
  if (/\b(perfume|deodorant|\bdeo\b|fragrance|parfum|cologne|eau\s*de|body\s*spray|body\s*mist|roll-?ons?|antiperspirants?|underarm|axe\b|wild\s*stone|fogg|denver|bellavita)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'fragrance' };
  }
  if (/\b(body\s*wash|body\s*lotion|soap|shower\s*gel|scrub|hand\s*wash|cleansing\s*pads?\s*for\s*face)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'bath-body' };
  }
  if (/\b(trimmer|shaver|razor|hair\s*dryer|hair\s*straightener|grooming\s*kit|callus\s*remover)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'appliances' };
  }
  if (/\b(nail\s*polish|nail\s*paint|nail\s*art|manicure)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'nailcare' };
  }
  if (/\b(beard\s*oil|beard\s*wash|shaving\s*cream|aftershave)\b/i.test(combined)) {
    return { category: 'beauty', subcategory: 'mens-grooming' };
  }

  // 10. FITNESS
  if (/\b(whey(?:\s*protein)?|protein\s*powder|creatine|bcaa|mass\s*gainer|multivitamin|fish\s*oil|omega\s*3|pre-workout|isolate\s*protein)\b/i.test(combined)) {
    return { category: 'fitness', subcategory: 'nutrition' };
  }
  if (/\b(treadmills?|motorized\s*treadmill|smartrun|smart\s*run|walking\s*pad|exercise\s*bike|spin\s*bike|air\s*bike|elliptical|rowing\s*machine|cross\s*trainer|dumbbells?|barbell|kettlebell|weight\s*plates?|gym\s*set|home\s*gym|resistance\s*bands?|pull\s*up\s*bar|hand\s*gripper|gym\s*bench)\b/i.test(combined)) {
    return { category: 'fitness', subcategory: 'gym-equipment' };
  }
  if (/\b(yoga\s*mat|yoga\s*block|yoga\s*strap)\b/i.test(combined)) {
    return { category: 'fitness', subcategory: 'yoga' };
  }
  if (
    /\b(goalie|goalkeeper|soccer|cricket|badminton|shuttlecock|football|volleyball|tennis\s*racket|boxing\s*gloves?|skipping\s*rope|sports?\s*gloves?|speed\s*radar|sports\s*gear|swimming\s*goggles?|jockstrap|athletic\s*supporter)\b/i.test(combined)
  ) {
    return { category: 'fitness', subcategory: 'sports-gear' };
  }

  // 11. GROCERY
  if (/\b(coffee|tea|green\s*tea|filter\s*coffee|darjeeling|assam\s*tea|coffee\s*beans?)\b/i.test(combined) && !/\b(table|furniture|desk|chair|wood)\b/i.test(combined)) {
    return { category: 'grocery', subcategory: 'coffee-tea' };
  }
  if (/\b(almonds?|badam|cashews?|kaju|walnuts?|akhrot|dates?|khajur|makhana|raisins?|kishmish|pistachios?|pista|dry\s*fruits?)\b/i.test(combined)) {
    return { category: 'grocery', subcategory: 'dry-fruits' };
  }
  if (/\b(healthy\s*binge|gift\s*hamper|gift\s*box.*(?:snack|chocolate|sweet)|chocolate|cookies?|biscuits?|namkeen|chips|wafers?|snacks?|gum\b|xylitol|chewing\s*gum|bubble\s*gum|mints?|vegetable\s*juice|fruit\s*juice|\bjuice\b|cold\s*drink|soft\s*drink)\b/i.test(combined)) {
    return { category: 'grocery', subcategory: 'snacks-beverages' };
  }
  if (
    /\b(cooking\s*oil|mustard\s*oil|olive\s*oil|sesame\s*oil|sunflower\s*oil|groundnut\s*oil|coconut\s*oil|cold\s*pressed.*oil|refined\s*oil|ghee|masala|turmeric|spices?|atta|flour|rice|basmati|dal|salt|sugar|honey|syrup|chia\s*seeds?|flax\s*seeds?)\b/i.test(combined) &&
    !/\b(diya|batti|candle|pooja|lamp)\b/i.test(combined)
  ) {
    return { category: 'grocery', subcategory: 'cooking-staples' };
  }
  if (/\b(oats|muesli|corn\s*flakes|cereals?|peanut\s*butter|fruit\s*jam|spread)\b/i.test(combined)) {
    return { category: 'grocery', subcategory: 'breakfast-dairy' };
  }

  // 12. AUTO
  if (/\b(helmet|riding\s*jacket|riding\s*gloves?|knee\s*pads?.*motorcycle|motorcycle\s*armor|bike\s*cover|car\s*cover|gear\s*shift\s*shoe\s*protector)\b/i.test(combined)) {
    return { category: 'auto', subcategory: 'helmets-riding' };
  }
  if (
    /\b(hero\s*motocorp|royal\s*enfield|bajaj\s*pulsar|tvs\s*apache|honda\s*activa|bike\s*lock|bicycle\s*lock|cycle\s*lock|anti\s*theft\s*bicycle|drum\s*brake|disc\s*brake|brake\s*shoe|motorcycle|scooter|bike\s*accessories)\b/i.test(combined)
  ) {
    return { category: 'auto', subcategory: 'bike-accessories' };
  }
  if (
    /\b(dash\s*cam|dashboard\s*camera|car\s*charger|tire\s*inflator|tyre\s*inflator|car\s*vacuum|wiper\s*blade|car\s*led|seat\s*belt\s*cover|steering\s*wheel\s*lock|jump\s*starter|obd2|car\s*reverse|car\s*door\s*guard|brake\s*(?:kit|pad|pads|rotor|rotors|disc)|driving\s*light|led\s*pods?|off\s*road\s*light|car\s*mats?|car\s*seat\s*cover|car\s*perfume|car\s*freshener|spark\s*plug)\b/i.test(combined)
  ) {
    return { category: 'auto', subcategory: 'car-accessories' };
  }

  // 13. BOOKS & CRAFTS
  if (/\b(books?|novels?|paperback|hardcover|bible|story\s*book|manga|comic|dungeons\s*&\s*dragons|board\s*book|boxed\s*set|quartet|trilogy|chronicles?|memoirs?|biograph(?:y|ies)|autobiograph(?:y|ies)|adventure\s*of\s*survival)\b/i.test(combined) && !/\b(shelf|rack|stand|case)\b/i.test(combined)) {
    return { category: 'books-stationery', subcategory: 'books' };
  }
  if (/\b(stationery|notebooks?|journals?|pens?|gel\s*pen|ball\s*pen|pencils?|highlighters?|desk\s*organizer|sticky\s*notes?)\b/i.test(combined)) {
    return { category: 'books-stationery', subcategory: 'stationery' };
  }
  if (/\b(acrylic\s*paint|water\s*color|canvas\s*board|sketch\s*book|paint\s*brush|artist\s*kit)\b/i.test(combined)) {
    return { category: 'books-stationery', subcategory: 'craft-supplies' };
  }

  // 14. FASHION
  const isFemale = /\b(womens?|womans?|females?|ladies|girls?|kurti|saree|sari|lehenga|anarkali|dress|dresses|bodycon|bra|bras|panty|panties|lingerie|palazzo|nighty|nightsuit)\b/i.test(combined);
  const isMale = /\b(mens?|mans?|males?|gents|boys?|polo|boxer|boxers|brief|briefs|vest|vests)\b/i.test(combined);

  if (
    /\b(shoes?|sneakers?|sandals?|slippers?|flip\s*flops?|crocs|boots?|loafers?|heels?|flats?|wedges?|jutis?|pumps?|sling\s*pumps?|slingback|socks?|compression\s*socks|ankle\s*socks)\b/i.test(combined) &&
    !/\b(rack|stand|deodorizer|horn|washing\s*machine)\b/i.test(combined)
  ) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-footwear' }
      : { category: 'men-fashion', subcategory: 'footwear' };
  }
  if (
    /\b(chronograph|analog\s*watch|digital\s*watch|wrist\s*watch|quartz\s*watch|fastrack.*watch|titan.*watch|fossil.*watch|casio.*watch|timex.*watch)\b/i.test(combined) &&
    !/\b(smartwatch|smart\s*watch|fitness\s*band|smart\s*band|smart\s*ring)\b/i.test(combined)
  ) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-watches' }
      : { category: 'men-fashion', subcategory: 'watches' };
  }
  if (/\b(earrings?|necklace|jewellery|bangles?|pendants?|bracelet|anklet|nose\s*ring)\b/i.test(combined)) {
    return { category: 'women-fashion', subcategory: 'jewellery' };
  }
  if (/\b(kurta|kurti|saree|\bsari\b|lehenga|anarkali|salwar|dupatta|sherwani)\b/i.test(combined)) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-ethnic' }
      : { category: 'men-fashion', subcategory: 'men-topwear' };
  }
  if (/\b(innerwear|lingerie|sleepwear|nightwear|nighty|night\s*suit|boxers?|briefs?|vests?|shapewear|bodysuit|thong|thermals?|thermal\s*(?:wear|set|top|bottom))\b/i.test(combined)) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-innerwear' }
      : { category: 'men-fashion', subcategory: 'innerwear' };
  }
  if (/\b(jeans|trousers?|chinos?|track\s*pants?|joggers?|shorts|palazzo|skirt|jeggings?|leggings?)\b/i.test(combined)) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-western' }
      : { category: 'men-fashion', subcategory: 'men-bottomwear' };
  }
  if (
    /\b(t-?shirt|shirts?|tops?(?!\s*(?:load|notch|tier|rank|speed|gear|cover|mount|rack|shelf|plate|surface))|blouses?|jackets?|hoodies?|sweatshirts?|sweaters?|blazers?|shrugs?|coats?|dresses?|bodycon)\b/i.test(combined)
  ) {
    return isFemale
      ? { category: 'women-fashion', subcategory: 'women-western' }
      : { category: 'men-fashion', subcategory: 'men-topwear' };
  }

  // 15. HOME & KITCHEN
  if (
    /\b(chopping\s*board|cutting\s*board|vegetable\s*cutter|hand\s*juicer|manual\s*juicer|cookware|pan|kadai|kadhai|tawa|pressure\s*cooker|dinner\s*set|water\s*bottle|flask|thermosteel|insulated\s*bottle|lunch\s*box|knife\s*set|bbq|grill|barbecue|chopper|peeler|milton|cello|napkin\s*rings?|gas\s*stove|induction\s*cooktop|mixing\s*bowl|kitchen\s*rack|spice\s*box|oil\s*dispenser|water\s*dispenser|ro\s*purifier|water\s*purifier)\b/i.test(combined)
  ) {
    return { category: 'home', subcategory: 'kitchen-dining' };
  }
  if (/\b(chair\s*set|plastic\s*chair|dining\s*chair|\bchairs?\b|sofa|dining\s*table|coffee\s*table|office\s*chair|standing\s*desk|study\s*table|wardrobe|bed\s*frame|bookshelf|furniture)\b/i.test(combined)) {
    return { category: 'home', subcategory: 'furniture' };
  }
  if (/\b(bedsheet|pillow\s*cover|pillows?|blanket|comforter|quilt|mattress|cushion\s*cover)\b/i.test(combined)) {
    return { category: 'home', subcategory: 'bedding' };
  }
  if (/\b(cloth\s*drying\s*stand|drying\s*rack|clothes\s*drying|storage\s*box|storage\s*rack|organizer|cloth\s*hangers?|shoe\s*rack|laundry\s*basket)\b/i.test(combined)) {
    return { category: 'home', subcategory: 'storage' };
  }
  if (
    /\b(welding\s*machine|air\s*compressor|pressure\s*washer|power\s*tool|drill|screwdriver|wrench|pliers|laser\s*level|tool\s*kit|soldering|hardware|brass\s*plumbing|sharkbite|wire\s*connectors?|reacher\s*grabber|grade\s*rod|hard\s*hat|electrical\s*wire|copper\s*wire|cables?\s*fr\s*pvc|sqmm\b|pvc\s*insulated\s*cable|cabinet\s*knobs?|cabinet\s*handles?|drawer\s*pulls?|glue\s*gun)\b/i.test(combined)
  ) {
    return { category: 'home', subcategory: 'tools' };
  }
  if (
    /\b(mosquito\s*(?:repellent|killer|zapper|racket|vaporiser|refill)|bug\s*zapper|fly\s*traps?|goodknight|all\s*out|mortein|odomos|detergent|dishwash|floor\s*cleaner|harpic|colin|lizol|spin\s*mop|wiper|broom|dustbin|garbage\s*bags?)\b/i.test(combined)
  ) {
    return { category: 'home', subcategory: 'cleaning' };
  }
  if (/\b(live\s*plant|tulsi|medicinal\s*plant|flower\s*seeds?|vegetable\s*seeds?|gardening|hose\s*nozzle|watering\s*wand|flower\s*pot|planters?|kneeler)\b/i.test(combined)) {
    return { category: 'home', subcategory: 'garden' };
  }
  if (
    /\b(wall\s*art|paintings?|wall\s*clock|flower\s*vases?|candles?|showpieces?|photo\s*frames?|curtains?|pooja\s*article|havan\s*kund|mandir|statues?|figurines?|lamps?|led\s*strip|fairy\s*lights?|diya\s*batti|vanity\s*light)\b/i.test(combined)
  ) {
    return { category: 'home', subcategory: 'decor' };
  }

  // Merchant-based intelligent fallback
  if (merchant === 'nykaa') return { category: 'beauty', subcategory: 'skincare' };
  if (merchant === 'myntra' || merchant === 'ajio') return { category: 'men-fashion', subcategory: 'clothing' };

  return null;
}
