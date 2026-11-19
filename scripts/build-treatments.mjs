// Crawls nuffieldhealth.com/treatments, classifies each treatment into a specialty,
// writes data/treatments.json (commercetools product-draft-like records).
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://www.nuffieldhealth.com';
const html = await (await fetch(`${BASE}/treatments`, { headers: { 'user-agent': 'Mozilla/5.0 (catalogue audit)' } })).text();

const seen = new Map();
for (const m of html.matchAll(/<a[^>]+href=["'](\/treatments\/[a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  const name = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (name && !seen.has(m[1])) seen.set(m[1], name);
}

const RULES = [
  ['spine', /spin|disc|laminect|cervical|lumbar|facet|kyphoplasty|vertebro|scoliosis|myelopathy|acdf|epidural|nerve root|sacroiliac/i],
  ['orthopaedics', /knee|hip|shoulder|elbow|ankle|foot|toe|bunion|hand|carpal|trigger finger|achilles|acl|pcl|hamstring|tendon|osteotomy|fusion|arthro|cartilage|chondro|meniscus|patella|fracture|ilizarov|osseointegration|joint|dupuytren|ganglion|tennis|cubital|trapeziectomy|bone graft|amputation|flat foot|hallux|keller|cheilectomy|manipulation under|steroid|prp|nstride|arthrosamid|fixation/i],
  ['cardiology-vascular', /cardi|cardiac|aort|angio|coronary|pacemaker|tavi|pfo|atrial|carotid|arterial|vascular|varicose|vein|venous|evar|evla|thread vein|sclerotherapy|venaseal|bypass|heart|mitral|defibrillator|thrombotic/i],
  ['cosmetic-reconstructive', /breast|facelift|rhinoplasty|blepharoplasty|liposuction|vaser|tummy|abdominoplasty|brow|botox|filler|chemical peel|body contouring|lift|otoplasty|pinnaplasty|labiaplasty|vulvoplasty|vaginoplasty|gynaecomastia|fat transfer|scar|areola|nipple|facial|genioplasty|chin|neck|gender|top surgery|craniofacial|lymph|capsulectomy|mastopexy|augmentation|resurfacing|xanthelasma|reconstruction/i],
  ['ophthalmology', /eye|cataract|glaucoma|retina|vitrectomy|macular|corneal|squint|ptosis|eyelid|lacrimal|dacryo|nasolacrimal|lens|laser eye|orbital|entropion|trabecul|migs|slt|yag|visual field|watery|dry eye/i],
  ['ent', /ear|sinus|tonsil|adenoid|septum|septoplasty|grommet|mastoid|stapedectomy|turbinect|nasal|polyp|audiolog|hearing|myringoplasty|microsuction|thyroid|parotid|submandibular|head and neck|palatoplasty|frenotomy|antral|balloon sinuplasty|fess/i],
  ['urology-prostate', /prostat|urolog|kidney|bladder|vasectomy|circumcision|hydrocele|epididym|orchidectomy|varicocele|penile|lue|turp|holep|rezum|aquablation|bulkamid|lithotripsy|nephrolithotomy|pcnl|ivp|turbt|nanoknife|hifu|spaceoar|urethral|female urology/i],
  ['gynaecology-fertility', /gynae|hysterectomy|endometri|fertility|egg|ovar|oophorectomy|myomectomy|novasure|d&c|dilation|lletz|cold coag|contracepti|coil|sterilisation|pelvic floor|prolapse|pregnancy|family planning|hormone|hrt|pms|menopause|vaginal|vulval|uterine|adnexal|pelvic|excision vaginal/i],
  ['bariatric', /gastric|bariatric|weight|sleeve|bypass surgery|balloon|endoscopic sleeve/i],
  ['colorectal', /colorectal|haemorrhoid|rectal|rectopexy|anal|fistula|pilonidal|stoma|ileostomy|ileal|proctocolectomy|sphincterotomy|starr|thd|anterior resection|abdominoperineal|polypectomy|hickman|picc/i],
  ['general-surgery', /hernia|gallbladder|cholecyst|appendic|splenectomy|liver|bile|laparoscop|adhesion|abdominal|reflux|hiatus|fundoplication|stretta|linx|adrenalectomy|parathyroid|thoracic|vats|sympathectomy|gastroparesis|endocrine/i],
  ['oncology', /oncolog|chemo|radio|brachy|imrt|igrt|srt|stereotactic|cancer|mastectomy|lumpectomy|biotherapy|lutetium|iodine|palliative|mohs|biopsy|hormone therapy|drug therapy/i],
  ['dermatology', /skin|mole|dermat|lesion|phototherapy|photodynamic|cryotherapy|laser therapy|sclerotherapy|thread/i],
  ['pain-management', /pain|injection|nerve block|guanethidine|trigger point|image guided|eswt|shockwave|acupuncture|dry needling|exroid|caudal/i],
  ['dental-maxillofacial', /dental|tooth|teeth|orthodont|wisdom|maxillofacial|oral|jaw|orthognathic/i],
];
const classify = n => (RULES.find(([, re]) => re.test(n)) ?? ['therapies-other'])[0];

const treatments = [...seen].map(([path, name]) => {
  const slug = path.split('/').pop();
  const specialty = classify(name);
  return {
    key: `tx-${slug}`,
    productType: { typeId: 'product-type', key: 'nh-treatment' },
    name: { 'en-GB': name },
    slug: { 'en-GB': slug },
    categories: [{ typeId: 'category', key: `cat-tx-${specialty}` }],
    masterVariant: {
      sku: `NH-TX-${slug.toUpperCase().slice(0, 60)}`,
      attributes: [
        { name: 'specialty', value: specialty },
        { name: 'bookingMode', value: 'enquiry' },
        { name: 'sourceUrl', value: BASE + path },
      ],
    },
  };
});

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/treatments.json', import.meta.url), JSON.stringify(treatments, null, 2));
const counts = {};
treatments.forEach(t => { const s = t.masterVariant.attributes[0].value; counts[s] = (counts[s] ?? 0) + 1; });
console.log(`wrote ${treatments.length} treatments`, counts);
