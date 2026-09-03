-- ============================================================
-- ข้อมูลรุ่นรถและแบบรถจริงของกิจการ (จากไฟล์ "model รถ.xlsx")
--
--   mc_models   : 31 รุ่น ผูกกับยี่ห้อที่มีอยู่แล้ว (BR01-BR08)
--   mc_variants : 63 แบบ (รหัส BAAB ของบริษัทรถ) ผูกกับรุ่นของตัวเอง
--
-- รหัสรุ่น = ชื่อรุ่นตัวพิมพ์ใหญ่ · รหัสแบบ = รหัส BAAB ตามเอกสารบริษัทรถ (คงเคาะวรรคไว้)
-- ใช้ on conflict do nothing เพื่อไม่ทับของที่ผู้ใช้แก้ไปแล้ว
-- ============================================================

insert into public.mc_models (code, name, brand_id)
select m.code, m.name, b.id
from (values
  ('DX1', 'DX1', 'BR05'),
  ('DZ2', 'DZ2', 'BR05'),
  ('DZ3 SPORT PLUS', 'DZ3 Sport Plus', 'BR05'),
  ('LEAD 125', 'LEAD 125', 'BR02'),
  ('PCX 160', 'PCX 160', 'BR02'),
  ('SCOOPY I', 'SCOOPY I', 'BR02'),
  ('SUPER CUB', 'SUPER CUB', 'BR02'),
  ('WAVE-110I', 'WAVE-110I', 'BR02'),
  ('WAVE125-I', 'WAVE125-I', 'BR02'),
  ('AEROX', 'Aerox', 'BR01'),
  ('FAZZIO', 'Fazzio', 'BR01'),
  ('FINN 2022', 'FINN 2022', 'BR01'),
  ('GRAND FILANO 2022', 'Grand Filano 2022', 'BR01'),
  ('NMAX', 'NMAX', 'BR01'),
  ('PG-1', 'PG-1', 'BR01'),
  ('XMAX 300', 'XMAX 300', 'BR01'),
  ('EM HACHI', 'EM Hachi', 'BR07'),
  ('EM LOVE', 'EM LOVE', 'BR07'),
  ('LEGEND', 'LEGEND', 'BR07'),
  ('LEGEND PRO', 'LEGEND PRO', 'BR07'),
  ('MILANO', 'MILANO', 'BR07'),
  ('OWEN LONG RANGE', 'OWEN LONG RANGE', 'BR07'),
  ('J200', 'J200', 'BR03'),
  ('X300 GP-TFT', 'X300 GP-TFT', 'BR03'),
  ('X300 GT-TFT', 'X300 GT-TFT', 'BR03'),
  ('SKS Z2', 'SKS Z2', 'BR08'),
  ('150X', '150X', 'BR04'),
  ('368E ETC', '368E ETC', 'BR04'),
  ('368G ETC', '368G ETC', 'BR04'),
  ('368K', '368K', 'BR04'),
  ('GT80', 'GT80', 'BR06')
) as m(code, name, brand_code)
join public.mc_brands b on b.code = m.brand_code
on conflict (code) do nothing;

insert into public.mc_variants (code, name, model_id)
select v.code, v.name, md.id
from (values
  ('DX1', 'DX1', 'DX1'),
  ('DZ2', 'DZ2', 'DZ2'),
  ('DZ3', 'DZ3', 'DZ3 SPORT PLUS'),
  ('NHX125S TH', 'NHX125S TH', 'LEAD 125'),
  ('NHX125T TH', 'NHX125T TH', 'LEAD 125'),
  ('NHX125AT TH', 'NHX125AT TH', 'LEAD 125'),
  ('WW160AS TH', 'WW160AS TH', 'PCX 160'),
  ('ACF110CBTS TH', 'ACF110CBTS TH', 'SCOOPY I'),
  ('ACF110CBTT TH', 'ACF110CBTT TH', 'SCOOPY I'),
  ('ACF110CBTT 3TH', 'ACF110CBTT 3TH', 'SCOOPY I'),
  ('NBC110MSBT 2TH', 'NBC110MSBT 2TH', 'SUPER CUB'),
  ('AFS110KSFS 3TH', 'AFS110KSFS 3TH', 'WAVE-110I'),
  ('AFS110MCBT 3TH', 'AFS110MCBT 3TH', 'WAVE-110I'),
  ('AFS110MCBT TH', 'AFS110MCBT TH', 'WAVE-110I'),
  ('AFS110MCBT 2TH', 'AFS110MCBT 2TH', 'WAVE-110I'),
  ('AFS125CSBT 2TH', 'AFS125CSBT 2TH', 'WAVE125-I'),
  ('AFS125CSBT TH', 'AFS125CSBT TH', 'WAVE125-I'),
  ('AFS125CSFS TH', 'AFS125CSFS TH', 'WAVE125-I'),
  ('D13100', 'D13100', 'AEROX'),
  ('BKF700', 'BKF700', 'FAZZIO'),
  ('BKFB00', 'BKFB00', 'FAZZIO'),
  ('BKFF00', 'BKFF00', 'FAZZIO'),
  ('BKFD00', 'BKFD00', 'FAZZIO'),
  ('BKFE00', 'BKFE00', 'FAZZIO'),
  ('B6FP00', 'B6FP00', 'FINN 2022'),
  ('B6FR00', 'B6FR00', 'FINN 2022'),
  ('B6FV00', 'B6FV00', 'FINN 2022'),
  ('DT0300', 'DT0300', 'FINN 2022'),
  ('DT0400', 'DT0400', 'FINN 2022'),
  ('DA6100', 'DA6100', 'FINN 2022'),
  ('DA6200', 'DA6200', 'FINN 2022'),
  ('DA6300', 'DA6300', 'FINN 2022'),
  ('BJK500', 'BJK500', 'GRAND FILANO 2022'),
  ('BJK600', 'BJK600', 'GRAND FILANO 2022'),
  ('BJKA00', 'BJKA00', 'GRAND FILANO 2022'),
  ('BJKC00', 'BJKC00', 'GRAND FILANO 2022'),
  ('BJKD00', 'BJKD00', 'GRAND FILANO 2022'),
  ('BJKE00', 'BJKE00', 'GRAND FILANO 2022'),
  ('BTF100', 'BTF100', 'NMAX'),
  ('BTM100', 'BTM100', 'NMAX'),
  ('BTM200', 'BTM200', 'NMAX'),
  ('BTF300', 'BTF300', 'NMAX'),
  ('BTF200', 'BTF200', 'NMAX'),
  ('D18100', 'D18100', 'PG-1'),
  ('D18300', 'D18300', 'PG-1'),
  ('BKAW00', 'BKAW00', 'XMAX 300'),
  ('DR9400', 'DR9400', 'XMAX 300'),
  ('DR9200', 'DR9200', 'XMAX 300'),
  ('EM HACHI', 'EM Hachi', 'EM HACHI'),
  ('EM LOVE', 'EM LOVE', 'EM LOVE'),
  ('LEGEND', 'LEGEND', 'LEGEND'),
  ('LEGEND PRO', 'LEGEND PRO', 'LEGEND PRO'),
  ('MILANO', 'MILANO', 'MILANO'),
  ('OWEN LONG RANGE', 'OWEN LONG RANGE', 'OWEN LONG RANGE'),
  ('J200', 'J200', 'J200'),
  ('X300C', 'X300C', 'X300 GP-TFT'),
  ('X300D', 'X300D', 'X300 GT-TFT'),
  ('SKS Z2', 'SKS Z2', 'SKS Z2'),
  ('ZT150X', 'ZT150X', '150X'),
  ('ZT368T-II-E-ETC', 'ZT368T-II-E-ETC', '368E ETC'),
  ('ZT368T-II-G-ETC', 'ZT368T-II-G-ETC', '368G ETC'),
  ('ZT368T-II-K', 'ZT368T-II-K', '368K'),
  ('C33A-0E03EFD', 'C33A-0E03EFD', 'GT80')
) as v(code, name, model_code)
join public.mc_models md on md.code = v.model_code
on conflict (code) do nothing;
