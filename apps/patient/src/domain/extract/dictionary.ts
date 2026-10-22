/**
 * Medical vocabulary used to recognise information in scanned documents.
 * Draft lists, aimed at common conditions and medicines in Kenya. Clinicians should review them.
 */

export interface AnalyteDef {
  name: string;
  aliases: string[];
  panel: string;
}

const P = {
  fbc: "Full blood count",
  dm: "Diabetes (HbA1c)",
  glucose: "Fasting blood sugar",
  lipid: "Lipid profile",
  kidney: "Kidney function (U&E)",
  liver: "Liver function",
  thyroid: "Thyroid function",
  hiv: "HIV viral load",
  other: "Other tests",
};

export const ANALYTES: AnalyteDef[] = [
  { name: "Haemoglobin", aliases: ["haemoglobin", "hemoglobin", "hgb", "hb"], panel: P.fbc },
  { name: "White cell count", aliases: ["white cell count", "white blood cells", "white blood cell count", "total leucocyte count", "total leukocyte count", "total wbc", "wbc"], panel: P.fbc },
  { name: "Platelets", aliases: ["platelet count", "platelets", "plt"], panel: P.fbc },
  { name: "Mean platelet volume", aliases: ["mean platelet volume", "mpv"], panel: P.fbc },
  { name: "MCV", aliases: ["mcv", "mean cell volume"], panel: P.fbc },
  { name: "HbA1c", aliases: ["hba1c", "glycated haemoglobin", "glycated hemoglobin", "glycosylated haemoglobin", "glycosylated hemoglobin", "a1c"], panel: P.dm },
  { name: "Estimated average glucose", aliases: ["estimated average glucose", "eag"], panel: P.dm },
  { name: "Fasting glucose", aliases: ["fasting glucose", "glucose fasting", "fasting blood sugar", "fasting blood glucose", "fasting plasma glucose", "fbs", "fbg"], panel: P.glucose },
  { name: "Random glucose", aliases: ["random glucose", "glucose random", "random blood sugar", "random blood glucose", "rbs", "rbg"], panel: P.glucose },
  { name: "Total cholesterol", aliases: ["total cholesterol", "cholesterol total", "cholesterol"], panel: P.lipid },
  { name: "LDL cholesterol", aliases: ["ldl cholesterol", "ldl-c", "ldl"], panel: P.lipid },
  { name: "HDL cholesterol", aliases: ["hdl cholesterol", "hdl-c", "hdl"], panel: P.lipid },
  { name: "Triglycerides", aliases: ["triglycerides", "triglyceride", "tg"], panel: P.lipid },
  { name: "Creatinine", aliases: ["serum creatinine", "creatinine", "creat"], panel: P.kidney },
  { name: "Blood urea nitrogen", aliases: ["blood urea nitrogen", "bun"], panel: P.kidney },
  { name: "Urea", aliases: ["blood urea", "urea"], panel: P.kidney },
  { name: "Sodium", aliases: ["sodium", "na+", "na"], panel: P.kidney },
  { name: "Potassium", aliases: ["potassium", "k+", "k"], panel: P.kidney },
  { name: "eGFR", aliases: ["egfr", "estimated gfr", "glomerular filtration rate"], panel: P.kidney },
  { name: "ALT", aliases: ["alt", "sgpt", "alanine aminotransferase", "alanine transaminase"], panel: P.liver },
  { name: "AST", aliases: ["ast", "sgot", "aspartate aminotransferase", "aspartate transaminase"], panel: P.liver },
  { name: "ALP", aliases: ["alp", "alkaline phosphatase"], panel: P.liver },
  { name: "Bilirubin", aliases: ["total bilirubin", "bilirubin"], panel: P.liver },
  { name: "Albumin", aliases: ["albumin"], panel: P.liver },
  { name: "Total T3", aliases: ["total triiodothyronine", "total t3"], panel: P.thyroid },
  { name: "Total T4", aliases: ["total thyroxine", "total t4"], panel: P.thyroid },
  { name: "TSH", aliases: ["tsh", "thyroid stimulating hormone"], panel: P.thyroid },
  { name: "Free T4", aliases: ["free t4", "ft4"], panel: P.thyroid },
  { name: "Viral load", aliases: ["hiv viral load", "viral load"], panel: P.hiv },
  { name: "CD4 count", aliases: ["cd4 count", "cd4"], panel: P.hiv },
  { name: "Red cell count", aliases: ["red cell count", "red blood cells", "rbc count", "rbc"], panel: P.fbc },
  { name: "Haematocrit", aliases: ["haematocrit", "hematocrit", "packed cell volume", "pcv", "hct"], panel: P.fbc },
  { name: "MCH", aliases: ["mch", "mean cell haemoglobin"], panel: P.fbc },
  { name: "MCHC", aliases: ["mchc"], panel: P.fbc },
  { name: "RDW", aliases: ["rdw", "rdw-cv"], panel: P.fbc },
  { name: "Neutrophils", aliases: ["neutrophils", "neutrophil", "neut"], panel: P.fbc },
  { name: "Lymphocytes", aliases: ["lymphocytes", "lymphocyte", "lymph"], panel: P.fbc },
  { name: "Monocytes", aliases: ["monocytes", "monocyte"], panel: P.fbc },
  { name: "Eosinophils", aliases: ["eosinophils", "eosinophil"], panel: P.fbc },
  { name: "Basophils", aliases: ["basophils", "basophil"], panel: P.fbc },
  { name: "ESR", aliases: ["esr", "erythrocyte sedimentation rate"], panel: P.other },
  { name: "Chloride", aliases: ["chloride", "cl-"], panel: P.kidney },
  { name: "Bicarbonate", aliases: ["bicarbonate", "hco3"], panel: P.kidney },
  { name: "Calcium", aliases: ["calcium", "total calcium"], panel: P.other },
  { name: "GGT", aliases: ["ggt", "gamma gt", "gamma-glutamyl transferase", "gamma glutamyl transferase", "gamma glutamyl transpeptidase"], panel: P.liver },
  { name: "Total protein", aliases: ["total protein", "protein total"], panel: P.liver },
  { name: "Ferritin", aliases: ["ferritin"], panel: "Iron studies" },
  { name: "Total iron binding capacity", aliases: ["total iron binding capacity", "tibc"], panel: "Iron studies" },
  { name: "Transferrin saturation", aliases: ["transferrin saturation", "tsat"], panel: "Iron studies" },
  { name: "Serum iron", aliases: ["serum iron", "iron"], panel: "Iron studies" },
  { name: "Vitamin B12", aliases: ["vitamin b12", "b12", "cobalamin"], panel: "Vitamins" },
  { name: "Vitamin D", aliases: ["25-oh vitamin d", "vitamin d", "25 oh vit d"], panel: "Vitamins" },
  { name: "INR", aliases: ["inr"], panel: P.other },
  { name: "PSA", aliases: ["psa", "prostate specific antigen"], panel: P.other },
  { name: "CRP", aliases: ["crp", "c-reactive protein"], panel: P.other },
  { name: "Uric acid", aliases: ["uric acid"], panel: P.other },
];

export interface ConditionDef {
  name: string;
  keywords: string[];
  chronic: boolean;
}

// More specific entries come first: the first match wins.
export const CONDITIONS: ConditionDef[] = [
  { name: "Type 2 diabetes", keywords: ["type 2 diabetes", "type ii diabetes", "t2dm", "dm type 2", "diabetes mellitus type 2", "type 2 dm"], chronic: true },
  { name: "Type 1 diabetes", keywords: ["type 1 diabetes", "type i diabetes", "t1dm"], chronic: true },
  { name: "Gestational diabetes", keywords: ["gestational diabetes", "gdm"], chronic: false },
  { name: "Prediabetes", keywords: ["prediabetes", "pre-diabetes", "impaired fasting glucose", "impaired glucose tolerance"], chronic: true },
  { name: "Diabetes", keywords: ["diabetes", "diabetic"], chronic: true },
  { name: "Hypertension", keywords: ["hypertension", "htn", "high blood pressure"], chronic: true },
  { name: "Hyperlipidaemia", keywords: ["hyperlipidaemia", "hyperlipidemia", "dyslipidaemia", "dyslipidemia", "high cholesterol", "hypercholesterolaemia"], chronic: true },
  { name: "Iron deficiency anaemia", keywords: ["iron deficiency anaemia", "iron deficiency anemia", "ida"], chronic: false },
  { name: "Anaemia", keywords: ["anaemia", "anemia"], chronic: false },
  { name: "Asthma", keywords: ["asthma"], chronic: true },
  { name: "COPD", keywords: ["copd", "chronic obstructive"], chronic: true },
  { name: "HIV", keywords: ["hiv", "plhiv"], chronic: true },
  { name: "Tuberculosis", keywords: ["tuberculosis", "ptb", "pulmonary tb"], chronic: false },
  { name: "Malaria", keywords: ["malaria", "falciparum"], chronic: false },
  { name: "Typhoid", keywords: ["typhoid"], chronic: false },
  { name: "Tonsillitis", keywords: ["tonsillitis"], chronic: false },
  { name: "Pneumonia", keywords: ["pneumonia"], chronic: false },
  { name: "Urinary tract infection", keywords: ["urinary tract infection", "uti"], chronic: false },
  { name: "Chronic kidney disease", keywords: ["chronic kidney disease", "ckd"], chronic: true },
  { name: "Heart failure", keywords: ["heart failure", "ccf", "congestive cardiac failure"], chronic: true },
  { name: "Epilepsy", keywords: ["epilepsy", "seizure disorder"], chronic: true },
  { name: "Sickle cell disease", keywords: ["sickle cell"], chronic: true },
  { name: "Depression", keywords: ["depression", "depressive"], chronic: true },
  { name: "Hypothyroidism", keywords: ["hypothyroidism"], chronic: true },
  { name: "Osteoarthritis", keywords: ["osteoarthritis"], chronic: true },
  { name: "Gout", keywords: ["gout"], chronic: true },
  { name: "Peptic ulcer disease", keywords: ["peptic ulcer", "pud"], chronic: false },
  { name: "Obesity", keywords: ["obesity", "morbid obesity"], chronic: true },
  { name: "Hyperthyroidism", keywords: ["hyperthyroidism", "thyrotoxicosis", "graves disease", "graves' disease"], chronic: true },
  { name: "Goitre", keywords: ["goitre", "goiter"], chronic: true },
  { name: "Coronary heart disease", keywords: ["coronary heart disease", "coronary artery disease", "ischaemic heart disease", "ischemic heart disease", "ihd", "cad"], chronic: true },
  { name: "Angina", keywords: ["angina"], chronic: true },
  { name: "Heart attack (myocardial infarction)", keywords: ["myocardial infarction", "nstemi", "stemi", "heart attack"], chronic: false },
  { name: "Atrial fibrillation", keywords: ["atrial fibrillation", "af", "afib"], chronic: true },
  { name: "Stroke", keywords: ["stroke", "cerebrovascular accident", "cva", "tia", "transient ischaemic attack"], chronic: false },
  { name: "Deep vein thrombosis", keywords: ["deep vein thrombosis", "dvt"], chronic: false },
  { name: "Pulmonary embolism", keywords: ["pulmonary embolism"], chronic: false },
  { name: "Rheumatic heart disease", keywords: ["rheumatic heart disease", "rhd"], chronic: true },
  { name: "Cardiomyopathy", keywords: ["cardiomyopathy"], chronic: true },
  { name: "Acute kidney injury", keywords: ["acute kidney injury", "aki"], chronic: false },
  { name: "Kidney stones", keywords: ["kidney stones", "renal calculi", "nephrolithiasis", "urolithiasis"], chronic: false },
  { name: "Enlarged prostate (BPH)", keywords: ["benign prostatic hyperplasia", "bph", "enlarged prostate"], chronic: true },
  { name: "Chronic hepatitis B", keywords: ["chronic hepatitis b", "hepatitis b infection", "hbv infection", "hbsag positive"], chronic: true },
  { name: "Hepatitis C", keywords: ["hepatitis c", "hcv infection"], chronic: true },
  { name: "Liver cirrhosis", keywords: ["cirrhosis"], chronic: true },
  { name: "Fatty liver disease", keywords: ["fatty liver", "nafld", "masld", "hepatic steatosis"], chronic: true },
  { name: "Gastro-oesophageal reflux disease", keywords: ["gastro-oesophageal reflux", "gastroesophageal reflux", "gord", "gerd"], chronic: true },
  { name: "Gastritis", keywords: ["gastritis"], chronic: false },
  { name: "H. pylori infection", keywords: ["h. pylori", "h pylori", "helicobacter pylori"], chronic: false },
  { name: "Gastroenteritis", keywords: ["gastroenteritis"], chronic: false },
  { name: "Brucellosis", keywords: ["brucellosis"], chronic: false },
  { name: "Amoebiasis", keywords: ["amoebiasis", "amebiasis"], chronic: false },
  { name: "Schistosomiasis", keywords: ["schistosomiasis", "bilharzia"], chronic: false },
  { name: "Intestinal worms", keywords: ["helminthiasis", "intestinal worms", "ascariasis"], chronic: false },
  { name: "Leishmaniasis (kala-azar)", keywords: ["leishmaniasis", "kala-azar", "kala azar"], chronic: false },
  { name: "Dengue", keywords: ["dengue"], chronic: false },
  { name: "Syphilis", keywords: ["syphilis"], chronic: false },
  { name: "Meningitis", keywords: ["meningitis"], chronic: false },
  { name: "Cellulitis", keywords: ["cellulitis"], chronic: false },
  { name: "Bronchitis", keywords: ["bronchitis"], chronic: false },
  { name: "Sinusitis", keywords: ["sinusitis"], chronic: false },
  { name: "Pharyngitis", keywords: ["pharyngitis"], chronic: false },
  { name: "Ear infection (otitis media)", keywords: ["otitis media", "aom"], chronic: false },
  { name: "Conjunctivitis", keywords: ["conjunctivitis"], chronic: false },
  { name: "Upper respiratory tract infection", keywords: ["upper respiratory tract infection", "urti"], chronic: false },
  { name: "COVID-19", keywords: ["covid-19", "covid-19 infection", "covid-19 pneumonia", "sars-cov-2 infection"], chronic: false },
  { name: "Rheumatoid arthritis", keywords: ["rheumatoid arthritis"], chronic: true },
  { name: "Lupus (SLE)", keywords: ["systemic lupus", "sle", "lupus"], chronic: true },
  { name: "Osteoporosis", keywords: ["osteoporosis"], chronic: true },
  { name: "Migraine", keywords: ["migraine"], chronic: true },
  { name: "Glaucoma", keywords: ["glaucoma"], chronic: true },
  { name: "Cataract", keywords: ["cataract"], chronic: false },
  { name: "Eczema", keywords: ["eczema", "atopic dermatitis"], chronic: true },
  { name: "Psoriasis", keywords: ["psoriasis"], chronic: true },
  { name: "Anxiety disorder", keywords: ["anxiety disorder", "generalised anxiety", "generalized anxiety"], chronic: true },
  { name: "Bipolar disorder", keywords: ["bipolar"], chronic: true },
  { name: "Schizophrenia", keywords: ["schizophrenia"], chronic: true },
  { name: "Thalassaemia", keywords: ["thalassaemia", "thalassemia"], chronic: true },
  { name: "Pre-eclampsia", keywords: ["pre-eclampsia", "preeclampsia"], chronic: false },
  { name: "Breast cancer", keywords: ["breast cancer", "carcinoma of the breast", "breast carcinoma"], chronic: true },
  { name: "Cervical cancer", keywords: ["cervical cancer", "carcinoma of the cervix", "cervical carcinoma"], chronic: true },
  { name: "Prostate cancer", keywords: ["prostate cancer", "carcinoma of the prostate", "prostate carcinoma"], chronic: true },
  { name: "Oesophageal cancer", keywords: ["oesophageal cancer", "esophageal cancer", "oesophageal carcinoma"], chronic: true },
];

/** Medicines usually bought without a prescription. Everything else defaults to prescription-only. */
export const OTC_MEDICINES = ["paracetamol", "ors", "oral rehydration", "zinc", "multivitamin", "vitamin", "folic acid", "ferrous", "antacid", "cetirizine", "loratadine"];

// Order matters: more specific patterns first ("twice daily" before "daily").
export const FREQUENCIES: [RegExp, string][] = [
  [/\b(bd|b\.d\.|bid|twice daily|twice a day|12 ?hourly)\b/i, "Twice daily"],
  [/\b(tds|t\.d\.s\.|tid|three times (a day|daily)|8 ?hourly)\b/i, "Three times daily"],
  [/\b(qds|q\.d\.s\.|qid|four times (a day|daily)|6 ?hourly)\b/i, "Four times daily"],
  [/\b(nocte|at night)\b/i, "At night"],
  [/\b(mane|in the morning)\b/i, "In the morning"],
  [/\bweekly\b/i, "Once a week"],
  [/\bstat\b/i, "Single dose now"],
  [/\b(od|o\.d\.|once daily|once a day|daily|qd)\b/i, "Once daily"],
];

export const PRN = /\b(prn|when needed|as needed|as required)\b/i;

export interface VaccineDef {
  name: string;
  keywords: string[];
}

export const VACCINES: VaccineDef[] = [
  { name: "Influenza", keywords: ["influenza", "flu vaccine", "flu jab"] },
  { name: "Hepatitis B", keywords: ["hepatitis b", "hep b", "hbv vaccine"] },
  { name: "Tetanus-diphtheria (Td)", keywords: ["tetanus", "td vaccine", "tetanus toxoid"] },
  { name: "HPV", keywords: ["hpv"] },
  { name: "COVID-19", keywords: ["covid", "sars-cov-2"] },
  { name: "Yellow fever", keywords: ["yellow fever"] },
  { name: "Typhoid", keywords: ["typhoid vaccine", "typbar"] },
  { name: "Pneumococcal", keywords: ["pneumococcal", "pcv"] },
  { name: "Rabies", keywords: ["rabies"] },
  { name: "Measles-Rubella", keywords: ["measles", "rubella"] },
  { name: "BCG", keywords: ["bcg"] },
];

export const FACILITY_WORDS = /(hospital|clinic|medical cent(re|er)|diagnostics|laborator(y|ies)|pharmacy|chemist|health cent(re|er)|nursing home|dispensary|maternity)/i;
