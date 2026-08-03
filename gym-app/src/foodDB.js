// 자주 먹는 음식/프랜차이즈 메뉴의 대략적인 영양성분을 미리 담아둔 로컬 데이터베이스.
// API 호출 없이 즉시, 무료로 계산 가능. 값은 Claude의 학습 데이터 기반 추정치라
// 공식 수치와 약간 다를 수 있음. 여기 없는 음식만 AI(웹검색)나 직접입력으로 보완.
//
// unit: "gram" (100g 기준) | "count" (1개/1인분 등 기준, baseQty=1)

export const FOOD_DB = [
  // ---- 기본 재료 (100g 기준) ----
  { cat:"기본재료", key:"닭가슴살", aliases:["닭가슴살","닭가슴"], unit:"gram", baseQty:100, protein:23, carbs:0, sugar:0, fat:1, kcal:110 },
  { cat:"기본재료", key:"닭다리살", aliases:["닭다리살","닭다리"], unit:"gram", baseQty:100, protein:19, carbs:0, sugar:0, fat:11, kcal:180 },
  { cat:"기본재료", key:"소고기 등심", aliases:["소고기 등심","소고기등심","등심"], unit:"gram", baseQty:100, protein:26, carbs:0, sugar:0, fat:18, kcal:260 },
  { cat:"기본재료", key:"돼지고기 삼겹살", aliases:["삼겹살"], unit:"gram", baseQty:100, protein:17, carbs:0, sugar:0, fat:30, kcal:330 },
  { cat:"기본재료", key:"돼지고기 목살", aliases:["목살"], unit:"gram", baseQty:100, protein:19, carbs:0, sugar:0, fat:22, kcal:270 },
  { cat:"기본재료", key:"연어", aliases:["연어"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:13, kcal:200 },
  { cat:"기본재료", key:"흰살생선", aliases:["흰살생선","대구","동태"], unit:"gram", baseQty:100, protein:18, carbs:0, sugar:0, fat:1, kcal:85 },
  { cat:"기본재료", key:"새우", aliases:["새우"], unit:"gram", baseQty:100, protein:20, carbs:1, sugar:0, fat:1, kcal:95 },
  { cat:"기본재료", key:"두부", aliases:["두부"], unit:"gram", baseQty:100, protein:8, carbs:2, sugar:1, fat:4, kcal:80 },
  { cat:"기본재료", key:"그릭요거트", aliases:["그릭요거트","그릭 요거트"], unit:"gram", baseQty:100, protein:10, carbs:4, sugar:4, fat:0.5, kcal:60 },
  { cat:"기본재료", key:"고구마", aliases:["고구마"], unit:"gram", baseQty:100, protein:1.5, carbs:27, sugar:6, fat:0.2, kcal:110 },
  { cat:"기본재료", key:"감자", aliases:["감자"], unit:"gram", baseQty:100, protein:2, carbs:17, sugar:1, fat:0.1, kcal:80 },
  { cat:"기본재료", key:"현미밥", aliases:["현미밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:6, carbs:65, sugar:1, fat:1.5, kcal:300 },
  { cat:"기본재료", key:"흰쌀밥", aliases:["흰쌀밥","쌀밥","백미밥","밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:6, carbs:67, sugar:0, fat:1, kcal:300 },
  { cat:"기본재료", key:"오트밀", aliases:["오트밀","귀리"], unit:"gram", baseQty:100, protein:13, carbs:60, sugar:1, fat:7, kcal:370 },
  { cat:"기본재료", key:"바나나", aliases:["바나나"], unit:"count", baseQty:1, protein:1.3, carbs:27, sugar:14, fat:0.4, kcal:105 },
  { cat:"기본재료", key:"사과", aliases:["사과"], unit:"count", baseQty:1, protein:0.5, carbs:25, sugar:19, fat:0.3, kcal:95 },
  { cat:"기본재료", key:"아몬드", aliases:["아몬드"], unit:"gram", baseQty:100, protein:21, carbs:22, sugar:4, fat:50, kcal:580 },
  { cat:"기본재료", key:"닭안심", aliases:["닭안심"], unit:"gram", baseQty:100, protein:23, carbs:0, sugar:0, fat:1, kcal:105 },
  { cat:"기본재료", key:"소고기 우둔살", aliases:["우둔살","소고기 우둔"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:4, kcal:130 },
  { cat:"기본재료", key:"돼지고기 안심", aliases:["돼지 안심","돼지안심"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:4, kcal:125 },
  { cat:"기본재료", key:"고등어", aliases:["고등어"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:12, kcal:190 },
  { cat:"기본재료", key:"참치캔", aliases:["참치캔","참치 캔"], unit:"count", baseQty:1, protein:20, carbs:0, sugar:0, fat:8, kcal:150 },
  { cat:"기본재료", key:"오징어", aliases:["오징어"], unit:"gram", baseQty:100, protein:18, carbs:1, sugar:0, fat:1, kcal:90 },
  { cat:"기본재료", key:"낙지", aliases:["낙지"], unit:"gram", baseQty:100, protein:16, carbs:1, sugar:0, fat:0.5, kcal:75 },
  { cat:"기본재료", key:"단백질두유", aliases:["단백질두유","고단백두유"], unit:"count", baseQty:1, protein:12, carbs:6, sugar:2, fat:4, kcal:105, liquidMl:200 },
  { cat:"기본재료", key:"견과류믹스", aliases:["견과류","견과류믹스","하루견과"], unit:"count", baseQty:1, protein:5, carbs:8, sugar:2, fat:14, kcal:180 },
  { cat:"기본재료", key:"방울토마토", aliases:["방울토마토","토마토"], unit:"gram", baseQty:100, protein:1, carbs:5, sugar:4, fat:0.2, kcal:25 },
  { cat:"기본재료", key:"샐러드", aliases:["샐러드"], unit:"count", baseQty:1, protein:3, carbs:10, sugar:5, fat:6, kcal:110 },
  { cat:"기본재료", key:"닭가슴살 샐러드", aliases:["닭가슴살 샐러드","닭가슴살샐러드"], unit:"count", baseQty:1, protein:26, carbs:12, sugar:6, fat:8, kcal:230 },
  { cat:"기본재료", key:"식빵", aliases:["식빵"], unit:"count", baseQty:1, protein:3, carbs:19, sugar:2, fat:1.5, kcal:100 },
  { cat:"기본재료", key:"베이글", aliases:["베이글"], unit:"count", baseQty:1, protein:10, carbs:53, sugar:6, fat:2, kcal:270 },
  { cat:"기본재료", key:"통밀빵", aliases:["통밀빵"], unit:"count", baseQty:1, protein:4, carbs:17, sugar:2, fat:1.5, kcal:95 },
  { cat:"기본재료", key:"그래놀라", aliases:["그래놀라"], unit:"gram", baseQty:100, protein:10, carbs:60, sugar:20, fat:18, kcal:450 },
  { cat:"기본재료", key:"시리얼", aliases:["시리얼","콘푸로스트"], unit:"gram", baseQty:100, protein:6, carbs:84, sugar:25, fat:2, kcal:380 },
  { cat:"기본재료", key:"파스타", aliases:["파스타","스파게티"], unit:"count", baseQty:1, protein:18, carbs:80, sugar:8, fat:20, kcal:600 },
  { cat:"기본재료", key:"양파", aliases:["양파","양파 다진것"], unit:"gram", baseQty:100, protein:1.1, carbs:9, sugar:4.2, fat:0.1, kcal:40 },
  { cat:"기본재료", key:"마늘", aliases:["마늘","다진마늘","마늘쪽"], unit:"gram", baseQty:100, protein:6, carbs:33, sugar:1, fat:0.5, kcal:140 },
  { cat:"기본재료", key:"대파", aliases:["대파","파","쪽파"], unit:"gram", baseQty:100, protein:1.8, carbs:7, sugar:2, fat:0.2, kcal:32 },
  { cat:"기본재료", key:"생강", aliases:["생강","다진생강"], unit:"gram", baseQty:100, protein:1.8, carbs:18, sugar:1.7, fat:0.8, kcal:80 },
  { cat:"기본재료", key:"계란흰자", aliases:["계란흰자","달걀흰자","흰자"], unit:"gram", baseQty:100, protein:11, carbs:0.7, sugar:0.7, fat:0.2, kcal:52 },
  { cat:"기본재료", key:"삼치", aliases:["삼치"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:8, kcal:155 },
  { cat:"기본재료", key:"명태", aliases:["명태","동태살"], unit:"gram", baseQty:100, protein:17, carbs:0, sugar:0, fat:0.7, kcal:80 },
  { cat:"기본재료", key:"병아리콩", aliases:["병아리콩","치커피"], unit:"gram", baseQty:100, protein:19, carbs:61, sugar:11, fat:6, kcal:360 },
  { cat:"기본재료", key:"렌틸콩", aliases:["렌틸콩","렌즈콩"], unit:"gram", baseQty:100, protein:25, carbs:60, sugar:2, fat:1, kcal:350 },
  { cat:"기본재료", key:"검은콩", aliases:["검은콩","서리태"], unit:"gram", baseQty:100, protein:34, carbs:30, sugar:7, fat:15, kcal:400 },
  { cat:"기본재료", key:"땅콩버터", aliases:["땅콩버터","피넛버터"], unit:"gram", baseQty:100, protein:25, carbs:20, sugar:9, fat:50, kcal:590 },
  { cat:"기본재료", key:"퀴노아", aliases:["퀴노아"], unit:"gram", baseQty:100, protein:14, carbs:64, sugar:6, fat:6, kcal:370 },
  { cat:"기본재료", key:"현미", aliases:["현미","생현미"], unit:"gram", baseQty:100, protein:7.5, carbs:76, sugar:1, fat:3, kcal:360 },
  { cat:"기본재료", key:"당면", aliases:["당면"], unit:"gram", baseQty:100, protein:0.2, carbs:87, sugar:0, fat:0.1, kcal:350 },
  { cat:"기본재료", key:"밀가루", aliases:["밀가루","부침가루"], unit:"gram", baseQty:100, protein:10, carbs:76, sugar:1, fat:1, kcal:360 },
  { cat:"기본재료", key:"옥수수", aliases:["옥수수","스위트콘"], unit:"gram", baseQty:100, protein:3.3, carbs:19, sugar:6, fat:1.2, kcal:90 },
  { cat:"기본재료", key:"단호박고구마", aliases:["밤고구마","호박고구마"], unit:"gram", baseQty:100, protein:1.5, carbs:30, sugar:9, fat:0.2, kcal:125 },
  { cat:"기본재료", key:"당근", aliases:["당근"], unit:"gram", baseQty:100, protein:0.9, carbs:10, sugar:5, fat:0.2, kcal:41 },
  { cat:"기본재료", key:"파프리카", aliases:["파프리카","피망"], unit:"gram", baseQty:100, protein:1, carbs:6, sugar:4, fat:0.3, kcal:26 },
  { cat:"기본재료", key:"애호박", aliases:["애호박","호박"], unit:"gram", baseQty:100, protein:1.2, carbs:3, sugar:2, fat:0.3, kcal:17 },
  { cat:"기본재료", key:"팽이버섯", aliases:["팽이버섯","팽이"], unit:"gram", baseQty:100, protein:2.7, carbs:8, sugar:0.2, fat:0.3, kcal:37 },
  { cat:"기본재료", key:"표고버섯", aliases:["표고버섯","표고"], unit:"gram", baseQty:100, protein:2.2, carbs:7, sugar:2, fat:0.5, kcal:34 },
  { cat:"기본재료", key:"새송이버섯", aliases:["새송이버섯","새송이"], unit:"gram", baseQty:100, protein:2.5, carbs:6, sugar:1.5, fat:0.4, kcal:33 },
  { cat:"기본재료", key:"부추", aliases:["부추"], unit:"gram", baseQty:100, protein:2.4, carbs:4, sugar:1, fat:0.5, kcal:27 },
  { cat:"기본재료", key:"미나리", aliases:["미나리"], unit:"gram", baseQty:100, protein:2, carbs:3, sugar:1, fat:0.3, kcal:20 },
  { cat:"기본재료", key:"청경채", aliases:["청경채"], unit:"gram", baseQty:100, protein:1.5, carbs:2, sugar:1, fat:0.2, kcal:13 },
  { cat:"기본재료", key:"배추", aliases:["배추","알배기배추"], unit:"gram", baseQty:100, protein:1.2, carbs:3, sugar:1.5, fat:0.2, kcal:16 },
  { cat:"기본재료", key:"무", aliases:["무","무우"], unit:"gram", baseQty:100, protein:0.9, carbs:4, sugar:2, fat:0.1, kcal:18 },
  { cat:"기본재료", key:"콩나물", aliases:["콩나물(생)","생콩나물"], unit:"gram", baseQty:100, protein:5, carbs:5, sugar:1, fat:1.5, kcal:45 },
  { cat:"기본재료", key:"아스파라거스", aliases:["아스파라거스"], unit:"gram", baseQty:100, protein:2.2, carbs:4, sugar:2, fat:0.1, kcal:20 },
  { cat:"기본재료", key:"케일", aliases:["케일"], unit:"gram", baseQty:100, protein:3.3, carbs:9, sugar:2, fat:0.7, kcal:49 },
  { cat:"기본재료", key:"셀러리", aliases:["셀러리"], unit:"gram", baseQty:100, protein:0.7, carbs:3, sugar:1.3, fat:0.2, kcal:14 },
  { cat:"기본재료", key:"꿀", aliases:["꿀"], unit:"gram", baseQty:100, protein:0.3, carbs:82, sugar:82, fat:0, kcal:304 },
  { cat:"기본재료", key:"단호박", aliases:["단호박"], unit:"gram", baseQty:100, protein:1.5, carbs:15, sugar:6, fat:0.2, kcal:65 },
  { cat:"기본재료", key:"브로콜리", aliases:["브로콜리"], unit:"gram", baseQty:100, protein:3, carbs:6, sugar:1.5, fat:0.4, kcal:34 },
  { cat:"기본재료", key:"아보카도", aliases:["아보카도"], unit:"count", baseQty:1, protein:2.7, carbs:12, sugar:1, fat:21, kcal:230 },

  // ---- 계란/유제품/보충제 (개당·스쿱당) ----
  { cat:"유제품·보충제", key:"삶은 계란", aliases:["삶은계란","삶은 계란","계란","달걀"], unit:"count", baseQty:1, protein:6.5, carbs:0.5, sugar:0.5, fat:5, kcal:70, gramsPerServing:50 },
  { cat:"유제품·보충제", key:"계란후라이", aliases:["계란후라이","계란 후라이","후라이"], unit:"count", baseQty:1, protein:6.5, carbs:0.5, sugar:0.3, fat:7, kcal:90, gramsPerServing:50 },
  { cat:"유제품·보충제", key:"우유", aliases:["우유"], unit:"gram", baseQty:200, protein:6.6, carbs:9.4, sugar:9.4, fat:6.8, kcal:130, liquidMl:200 },
  { cat:"유제품·보충제", key:"두유", aliases:["두유"], unit:"gram", baseQty:200, protein:7, carbs:9, sugar:6, fat:4, kcal:100, liquidMl:200 },
  { cat:"유제품·보충제", key:"프로틴쉐이크(WPI)", aliases:["프로틴","단백질쉐이크","웨이프로틴","쉐이크","프로틴쉐이크","프로틴 쉐이크"], unit:"count", baseQty:1, protein:24, carbs:3, sugar:1, fat:1, kcal:120, liquidMl:250, fixedLiquid:true },
  { cat:"유제품·보충제", key:"체다치즈", aliases:["치즈","체다치즈"], unit:"count", baseQty:1, protein:4, carbs:1, sugar:0.5, fat:6, kcal:70, gramsPerServing:20 },
  { cat:"유제품·보충제", key:"저지방우유", aliases:["저지방우유"], unit:"count", baseQty:1, protein:7, carbs:10, sugar:10, fat:2, kcal:90, gramsPerServing:200 },
  { cat:"유제품·보충제", key:"요거트", aliases:["요거트","플레인요거트"], unit:"count", baseQty:1, protein:5, carbs:12, sugar:11, fat:3, kcal:95, gramsPerServing:150 },
  { cat:"유제품·보충제", key:"모짜렐라치즈", aliases:["모짜렐라","모짜렐라치즈"], unit:"count", baseQty:1, protein:6, carbs:1, sugar:0.5, fat:6, kcal:80, gramsPerServing:25 },
  { cat:"유제품·보충제", key:"크림치즈", aliases:["크림치즈"], unit:"count", baseQty:1, protein:2, carbs:2, sugar:2, fat:10, kcal:100, gramsPerServing:30 },
  { cat:"유제품·보충제", key:"리코타치즈", aliases:["리코타치즈"], unit:"count", baseQty:1, protein:4, carbs:2, sugar:1, fat:5, kcal:70, gramsPerServing:50 },
  { cat:"유제품·보충제", key:"생크림", aliases:["생크림","휘핑크림"], unit:"count", baseQty:1, protein:1, carbs:3, sugar:3, fat:20, kcal:200, gramsPerServing:50 },
  { cat:"유제품·보충제", key:"연유", aliases:["연유"], unit:"count", baseQty:1, protein:2, carbs:17, sugar:17, fat:2, kcal:90, gramsPerServing:30 },
  { cat:"유제품·보충제", key:"프로틴바(보충제)", aliases:["프로틴바 보충제"], unit:"count", baseQty:1, protein:20, carbs:22, sugar:6, fat:7, kcal:220, gramsPerServing:60 },
  { cat:"유제품·보충제", key:"BCAA", aliases:["BCAA","아미노산"], unit:"count", baseQty:1, protein:5, carbs:1, sugar:0, fat:0, kcal:25, gramsPerServing:10 },
  { cat:"유제품·보충제", key:"게이너", aliases:["게이너","웨이트게이너"], unit:"count", baseQty:1, protein:30, carbs:90, sugar:20, fat:6, kcal:550, gramsPerServing:150 },
  { cat:"유제품·보충제", key:"카제인프로틴", aliases:["카제인","카제인프로틴"], unit:"count", baseQty:1, protein:24, carbs:4, sugar:1, fat:1, kcal:125, gramsPerServing:35 },

  // ---- 한식 (1인분 기준) ----
  { cat:"한식", key:"제육볶음", aliases:["제육볶음"], unit:"count", baseQty:1, protein:25, carbs:20, sugar:8, fat:22, kcal:400 },
  { cat:"한식", key:"불고기", aliases:["불고기"], unit:"count", baseQty:1, protein:28, carbs:18, sugar:10, fat:20, kcal:380 },
  { cat:"한식", key:"김치찌개", aliases:["김치찌개"], unit:"count", baseQty:1, protein:15, carbs:10, sugar:3, fat:12, kcal:220 },
  { cat:"한식", key:"된장찌개", aliases:["된장찌개"], unit:"count", baseQty:1, protein:12, carbs:12, sugar:3, fat:8, kcal:180 },
  { cat:"한식", key:"순두부찌개", aliases:["순두부찌개"], unit:"count", baseQty:1, protein:14, carbs:10, sugar:3, fat:14, kcal:240 },
  { cat:"한식", key:"삼계탕", aliases:["삼계탕"], unit:"count", baseQty:1, protein:40, carbs:20, sugar:2, fat:25, kcal:500 },
  { cat:"한식", key:"비빔밥", aliases:["비빔밥"], unit:"count", baseQty:1, protein:15, carbs:90, sugar:8, fat:14, kcal:560 },
  { cat:"한식", key:"김밥", aliases:["김밥"], unit:"count", baseQty:1, protein:8, carbs:55, sugar:4, fat:8, kcal:320 },
  { cat:"한식", key:"라면", aliases:["라면"], unit:"count", baseQty:1, protein:10, carbs:78, sugar:5, fat:16, kcal:500 },
  { cat:"한식", key:"짜장면", aliases:["짜장면"], unit:"count", baseQty:1, protein:15, carbs:90, sugar:10, fat:18, kcal:630 },
  { cat:"한식", key:"짬뽕", aliases:["짬뽕"], unit:"count", baseQty:1, protein:20, carbs:70, sugar:6, fat:15, kcal:550 },
  { cat:"한식", key:"돈까스", aliases:["돈까스","돈가스"], unit:"count", baseQty:1, protein:22, carbs:55, sugar:8, fat:30, kcal:650 },
  { cat:"한식", key:"냉면", aliases:["냉면"], unit:"count", baseQty:1, protein:12, carbs:80, sugar:15, fat:5, kcal:450 },
  { cat:"한식", key:"떡볶이", aliases:["떡볶이"], unit:"count", baseQty:1, protein:8, carbs:75, sugar:20, fat:6, kcal:400 },
  { cat:"한식", key:"순대", aliases:["순대"], unit:"count", baseQty:1, protein:12, carbs:25, sugar:2, fat:10, kcal:250 },
  { cat:"한식", key:"국밥", aliases:["국밥"], unit:"count", baseQty:1, protein:22, carbs:55, sugar:2, fat:14, kcal:450 },
  { cat:"한식", key:"설렁탕", aliases:["설렁탕"], unit:"count", baseQty:1, protein:25, carbs:50, sugar:1, fat:12, kcal:420 },
  { cat:"한식", key:"갈비탕", aliases:["갈비탕"], unit:"count", baseQty:1, protein:28, carbs:50, sugar:2, fat:18, kcal:500 },
  { cat:"한식", key:"부대찌개", aliases:["부대찌개"], unit:"count", baseQty:1, protein:20, carbs:35, sugar:6, fat:22, kcal:430 },
  { cat:"한식", key:"감자탕", aliases:["감자탕","뼈해장국"], unit:"count", baseQty:1, protein:30, carbs:30, sugar:3, fat:20, kcal:450 },
  { cat:"한식", key:"닭갈비", aliases:["닭갈비"], unit:"count", baseQty:1, protein:30, carbs:30, sugar:12, fat:18, kcal:400 },
  { cat:"한식", key:"찜닭", aliases:["찜닭"], unit:"count", baseQty:1, protein:35, carbs:45, sugar:18, fat:15, kcal:470 },
  { cat:"한식", key:"족발", aliases:["족발"], unit:"count", baseQty:1, protein:40, carbs:5, sugar:3, fat:30, kcal:460 },
  { cat:"한식", key:"보쌈", aliases:["보쌈"], unit:"count", baseQty:1, protein:35, carbs:3, sugar:1, fat:32, kcal:440 },
  { cat:"한식", key:"곱창", aliases:["곱창"], unit:"count", baseQty:1, protein:20, carbs:5, sugar:2, fat:35, kcal:420 },
  { cat:"한식", key:"삼겹살 구이", aliases:["삼겹살 구이","삼겹살구이"], unit:"count", baseQty:1, protein:30, carbs:2, sugar:0, fat:55, kcal:640 },
  { cat:"한식", key:"마라탕", aliases:["마라탕"], unit:"count", baseQty:1, protein:25, carbs:40, sugar:5, fat:25, kcal:500 },
  { cat:"한식", key:"쌀국수", aliases:["쌀국수"], unit:"count", baseQty:1, protein:20, carbs:65, sugar:5, fat:8, kcal:420 },
  { cat:"한식", key:"우동", aliases:["우동"], unit:"count", baseQty:1, protein:12, carbs:70, sugar:5, fat:5, kcal:380 },
  { cat:"한식", key:"칼국수", aliases:["칼국수"], unit:"count", baseQty:1, protein:15, carbs:75, sugar:3, fat:6, kcal:420 },
  { cat:"한식", key:"제육덮밥", aliases:["제육덮밥"], unit:"count", baseQty:1, protein:28, carbs:90, sugar:10, fat:22, kcal:680 },
  { cat:"한식", key:"치킨마요덮밥", aliases:["치킨마요"], unit:"count", baseQty:1, protein:22, carbs:95, sugar:10, fat:25, kcal:700 },
  { cat:"한식", key:"카레라이스", aliases:["카레","카레라이스"], unit:"count", baseQty:1, protein:14, carbs:95, sugar:8, fat:15, kcal:580 },
  { cat:"한식", key:"오므라이스", aliases:["오므라이스"], unit:"count", baseQty:1, protein:16, carbs:90, sugar:8, fat:20, kcal:620 },
  { cat:"한식", key:"볶음밥", aliases:["볶음밥"], unit:"count", baseQty:1, protein:12, carbs:85, sugar:4, fat:18, kcal:560 },
  { cat:"한식", key:"토스트", aliases:["토스트","길거리토스트"], unit:"count", baseQty:1, protein:12, carbs:45, sugar:10, fat:16, kcal:380 },
  { cat:"한식", key:"핫도그", aliases:["핫도그"], unit:"count", baseQty:1, protein:8, carbs:30, sugar:6, fat:16, kcal:300 },
  { cat:"한식", key:"어묵", aliases:["어묵","오뎅"], unit:"count", baseQty:1, protein:4, carbs:6, sugar:1, fat:1, kcal:50 },
  { cat:"한식", key:"튀김", aliases:["튀김"], unit:"count", baseQty:1, protein:3, carbs:15, sugar:1, fat:8, kcal:145 },

  // ---- 치킨 프랜차이즈 (1마리 기준) ----
  { cat:"치킨", key:"bhc 맛초킹", aliases:["맛초킹"], brand:"bhc", unit:"count", baseQty:1, protein:128, carbs:150, sugar:70, fat:120, kcal:2180 },
  { cat:"치킨", key:"bhc 뿌링클", aliases:["뿌링클"], brand:"bhc", unit:"count", baseQty:1, protein:115, carbs:130, sugar:45, fat:130, kcal:2200 },
  { cat:"치킨", key:"bhc 후라이드", aliases:["bhc 후라이드"], brand:"bhc", unit:"count", baseQty:1, protein:130, carbs:60, sugar:3, fat:95, kcal:1700 },
  { cat:"치킨", key:"후라이드치킨", aliases:["후라이드치킨","치킨","후라이드"], unit:"count", baseQty:1, protein:125, carbs:60, sugar:3, fat:95, kcal:1750 },
  { cat:"치킨", key:"양념치킨", aliases:["양념치킨","양념"], unit:"count", baseQty:1, protein:118, carbs:140, sugar:60, fat:100, kcal:2100 },
  { cat:"치킨", key:"간장치킨(일반)", aliases:["간장치킨 한마리"], unit:"count", baseQty:1, protein:120, carbs:110, sugar:45, fat:95, kcal:1900 },
  { cat:"치킨", key:"교촌 허니콤보", aliases:["허니콤보"], brand:"교촌", unit:"count", baseQty:1, protein:120, carbs:160, sugar:80, fat:110, kcal:2300 },
  { cat:"치킨", key:"교촌 레드콤보", aliases:["레드콤보"], brand:"교촌", unit:"count", baseQty:1, protein:118, carbs:140, sugar:40, fat:115, kcal:2250 },
  { cat:"치킨", key:"교촌 오리지날", aliases:["교촌 오리지날","교촌오리지날"], brand:"교촌", unit:"count", baseQty:1, protein:130, carbs:65, sugar:3, fat:95, kcal:1720 },
  { cat:"치킨", key:"BBQ 황금올리브", aliases:["황금올리브"], brand:"BBQ", unit:"count", baseQty:1, protein:130, carbs:90, sugar:5, fat:100, kcal:1900 },
  { cat:"치킨", key:"BBQ 자메이카 통다리", aliases:["자메이카"], brand:"BBQ", unit:"count", baseQty:1, protein:110, carbs:100, sugar:60, fat:90, kcal:1850 },
  { cat:"치킨", key:"BBQ 양념치킨", aliases:["BBQ 양념치킨"], brand:"BBQ", unit:"count", baseQty:1, protein:120, carbs:150, sugar:70, fat:105, kcal:2150 },
  { cat:"치킨", key:"굽네 고추바사삭", aliases:["고추바사삭"], brand:"굽네", unit:"count", baseQty:1, protein:125, carbs:60, sugar:8, fat:90, kcal:1650 },
  { cat:"치킨", key:"굽네 볼카노", aliases:["볼카노"], brand:"굽네", unit:"count", baseQty:1, protein:120, carbs:90, sugar:40, fat:95, kcal:1800 },
  { cat:"치킨", key:"노랑통닭 후라이드", aliases:["노랑통닭"], brand:"노랑통닭", unit:"count", baseQty:1, protein:128, carbs:55, sugar:3, fat:95, kcal:1700 },
  { cat:"치킨", key:"푸라닭 블랙알리오", aliases:["블랙알리오","푸라닭"], brand:"푸라닭", unit:"count", baseQty:1, protein:120, carbs:80, sugar:25, fat:100, kcal:1850 },
  { cat:"치킨", key:"60계 간장치킨", aliases:["60계"], brand:"60계", unit:"count", baseQty:1, protein:122, carbs:100, sugar:45, fat:100, kcal:1950 },
  { cat:"치킨", key:"처갓집 슈프림양념", aliases:["처갓집","슈프림양념"], brand:"처갓집", unit:"count", baseQty:1, protein:118, carbs:145, sugar:65, fat:105, kcal:2100 },
  { cat:"치킨", key:"네네 스노윙치킨", aliases:["스노윙","네네치킨"], brand:"네네", unit:"count", baseQty:1, protein:115, carbs:110, sugar:35, fat:120, kcal:2050 },
  { cat:"치킨", key:"지코바 양념치킨", aliases:["지코바"], brand:"지코바", unit:"count", baseQty:1, protein:110, carbs:90, sugar:45, fat:80, kcal:1600 },
  { cat:"치킨", key:"맘스터치 간장치킨", aliases:["간장치킨"], brand:"맘스터치", unit:"count", baseQty:1, protein:115, carbs:100, sugar:45, fat:95, kcal:1850 },
  { cat:"치킨", key:"닭강정", aliases:["닭강정"], unit:"count", baseQty:1, protein:45, carbs:70, sugar:35, fat:40, kcal:850 },

  // ---- 버거 프랜차이즈 (1개 기준) ----
  { cat:"버거", key:"맥도날드 빅맥", aliases:["빅맥"], brand:"맥도날드", unit:"count", baseQty:1, protein:26, carbs:44, sugar:9, fat:30, kcal:550 },
  { cat:"버거", key:"맥도날드 상하이버거", aliases:["상하이버거"], brand:"맥도날드", unit:"count", baseQty:1, protein:20, carbs:42, sugar:6, fat:24, kcal:480 },
  { cat:"버거", key:"맥도날드 맥치킨", aliases:["맥치킨"], brand:"맥도날드", unit:"count", baseQty:1, protein:15, carbs:38, sugar:5, fat:20, kcal:400 },
  { cat:"버거", key:"맥도날드 쿼터파운더", aliases:["쿼터파운더"], brand:"맥도날드", unit:"count", baseQty:1, protein:30, carbs:40, sugar:9, fat:28, kcal:520 },
  { cat:"버거", key:"롯데리아 불고기버거", aliases:["롯데리아 불고기버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:14, carbs:45, sugar:10, fat:16, kcal:380 },
  { cat:"버거", key:"롯데리아 새우버거", aliases:["새우버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:10, carbs:40, sugar:6, fat:18, kcal:380 },
  { cat:"버거", key:"맘스터치 싸이버거", aliases:["싸이버거"], brand:"맘스터치", unit:"count", baseQty:1, protein:22, carbs:45, sugar:6, fat:22, kcal:470 },
  { cat:"버거", key:"맘스터치 딥치즈버거", aliases:["딥치즈버거"], brand:"맘스터치", unit:"count", baseQty:1, protein:24, carbs:48, sugar:7, fat:28, kcal:540 },
  { cat:"버거", key:"맘스터치 화이트갈릭버거", aliases:["화이트갈릭"], brand:"맘스터치", unit:"count", baseQty:1, protein:20, carbs:46, sugar:8, fat:24, kcal:490 },
  { cat:"버거", key:"버거킹 와퍼", aliases:["와퍼"], brand:"버거킹", unit:"count", baseQty:1, protein:27, carbs:45, sugar:10, fat:40, kcal:660 },
  { cat:"버거", key:"버거킹 콰트로치즈와퍼", aliases:["콰트로치즈"], brand:"버거킹", unit:"count", baseQty:1, protein:35, carbs:46, sugar:10, fat:55, kcal:820 },
  { cat:"버거", key:"맥도날드 1955버거", aliases:["1955버거","1955"], brand:"맥도날드", unit:"count", baseQty:1, protein:27, carbs:42, sugar:9, fat:32, kcal:570 },
  { cat:"버거", key:"맥도날드 베이컨토마토디럭스", aliases:["베토디","베이컨토마토디럭스"], brand:"맥도날드", unit:"count", baseQty:1, protein:24, carbs:44, sugar:9, fat:28, kcal:530 },
  { cat:"버거", key:"KFC 징거버거", aliases:["징거버거"], brand:"KFC", unit:"count", baseQty:1, protein:22, carbs:45, sugar:6, fat:24, kcal:480 },
  { cat:"버거", key:"KFC 핫크리스피치킨", aliases:["핫크리스피"], brand:"KFC", unit:"count", baseQty:1, protein:19, carbs:12, sugar:1, fat:18, kcal:290 },
  { cat:"버거", key:"노브랜드버거 NBB오리지널", aliases:["노브랜드버거","NBB"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:18, carbs:40, sugar:8, fat:18, kcal:400 },
  { cat:"버거", key:"쉑쉑 쉑버거", aliases:["쉑버거","쉑쉑버거"], brand:"쉑쉑", unit:"count", baseQty:1, protein:29, carbs:35, sugar:8, fat:32, kcal:550 },
  { cat:"버거", key:"감자튀김", aliases:["감자튀김","후렌치후라이","프렌치프라이"], unit:"count", baseQty:1, protein:4, carbs:44, sugar:0, fat:17, kcal:340 },
  { cat:"버거", key:"치킨너겟", aliases:["너겟","치킨너겟"], unit:"count", baseQty:1, protein:3, carbs:3, sugar:0, fat:3, kcal:48 },

  // ---- 버거 추가 (단백질 위주) ----
  // 맥도날드
  { cat:"버거", key:"맥도날드 맥스파이시상하이", aliases:["맥스파이시","맥스파이시상하이"], brand:"맥도날드", unit:"count", baseQty:1, protein:27, carbs:48, sugar:7, fat:26, kcal:530 },
  { cat:"버거", key:"맥도날드 더블쿼터파운더", aliases:["더블쿼터파운더","더블쿼터"], brand:"맥도날드", unit:"count", baseQty:1, protein:48, carbs:41, sugar:9, fat:42, kcal:740 },
  { cat:"버거", key:"맥도날드 빅맥베이컨", aliases:["빅맥베이컨"], brand:"맥도날드", unit:"count", baseQty:1, protein:30, carbs:45, sugar:9, fat:33, kcal:600 },
  { cat:"버거", key:"맥도날드 더블불고기", aliases:["더블불고기"], brand:"맥도날드", unit:"count", baseQty:1, protein:22, carbs:44, sugar:12, fat:22, kcal:480 },
  { cat:"버거", key:"맥도날드 맥크리스피클래식", aliases:["맥크리스피","맥크리스피클래식"], brand:"맥도날드", unit:"count", baseQty:1, protein:28, carbs:50, sugar:8, fat:24, kcal:540 },
  { cat:"버거", key:"맥도날드 맥너겟", aliases:["맥너겟","치킨맥너겟"], brand:"맥도날드", unit:"count", baseQty:1, protein:25, carbs:26, sugar:0, fat:28, kcal:470 },

  // 버거킹
  { cat:"버거", key:"버거킹 통새우와퍼", aliases:["통새우와퍼"], brand:"버거킹", unit:"count", baseQty:1, protein:22, carbs:50, sugar:9, fat:32, kcal:580 },
  { cat:"버거", key:"버거킹 몬스터와퍼", aliases:["몬스터와퍼"], brand:"버거킹", unit:"count", baseQty:1, protein:48, carbs:47, sugar:11, fat:60, kcal:920 },
  { cat:"버거", key:"버거킹 치즈와퍼", aliases:["치즈와퍼"], brand:"버거킹", unit:"count", baseQty:1, protein:30, carbs:46, sugar:10, fat:45, kcal:710 },
  { cat:"버거", key:"버거킹 더블와퍼", aliases:["더블와퍼"], brand:"버거킹", unit:"count", baseQty:1, protein:45, carbs:46, sugar:10, fat:58, kcal:900 },
  { cat:"버거", key:"버거킹 통닭다리버거", aliases:["통닭다리버거"], brand:"버거킹", unit:"count", baseQty:1, protein:26, carbs:48, sugar:7, fat:28, kcal:550 },
  { cat:"버거", key:"버거킹 치킨킹", aliases:["치킨킹"], brand:"버거킹", unit:"count", baseQty:1, protein:28, carbs:52, sugar:6, fat:30, kcal:600 },

  // 롯데리아
  { cat:"버거", key:"롯데리아 한우불고기", aliases:["한우불고기","한우불고기버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:24, carbs:46, sugar:11, fat:26, kcal:530 },
  { cat:"버거", key:"롯데리아 더블한우불고기", aliases:["더블한우불고기"], brand:"롯데리아", unit:"count", baseQty:1, protein:38, carbs:47, sugar:12, fat:38, kcal:700 },
  { cat:"버거", key:"롯데리아 T렉스버거", aliases:["T렉스","티렉스버거","T렉스버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:32, carbs:50, sugar:9, fat:40, kcal:700 },
  { cat:"버거", key:"롯데리아 치킨버거", aliases:["롯데리아 치킨버거","롯데리아치킨버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:22, carbs:48, sugar:7, fat:24, kcal:490 },
  { cat:"버거", key:"롯데리아 모짜렐라인더버거", aliases:["모짜렐라인더버거","모짜렐라버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:26, carbs:52, sugar:8, fat:30, kcal:600 },
  { cat:"버거", key:"롯데리아 왕돈까스버거", aliases:["왕돈까스버거"], brand:"롯데리아", unit:"count", baseQty:1, protein:24, carbs:55, sugar:8, fat:32, kcal:620 },

  // 맘스터치
  { cat:"버거", key:"맘스터치 휠렛버거", aliases:["휠렛버거","휠렛"], brand:"맘스터치", unit:"count", baseQty:1, protein:23, carbs:44, sugar:6, fat:22, kcal:460 },
  { cat:"버거", key:"맘스터치 더블싸이버거", aliases:["더블싸이버거","더블싸이"], brand:"맘스터치", unit:"count", baseQty:1, protein:38, carbs:47, sugar:6, fat:36, kcal:700 },
  { cat:"버거", key:"맘스터치 언빌리버블버거", aliases:["언빌리버블버거","언빌리버블"], brand:"맘스터치", unit:"count", baseQty:1, protein:30, carbs:50, sugar:8, fat:34, kcal:640 },
  { cat:"버거", key:"맘스터치 인크레더블버거", aliases:["인크레더블버거","인크레더블"], brand:"맘스터치", unit:"count", baseQty:1, protein:34, carbs:52, sugar:9, fat:38, kcal:700 },
  { cat:"버거", key:"맘스터치 치킨택오버버거", aliases:["택오버버거","치킨택오버"], brand:"맘스터치", unit:"count", baseQty:1, protein:26, carbs:48, sugar:7, fat:28, kcal:560 },
  { cat:"버거", key:"맘스터치 싸이순살", aliases:["싸이순살","맘스터치 싸이순살"], brand:"맘스터치", unit:"count", baseQty:1, protein:28, carbs:20, sugar:2, fat:22, kcal:390 },

  // 노브랜드버거
  { cat:"버거", key:"노브랜드버거 시그니처트리플", aliases:["시그니처트리플","NBB트리플"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:42, carbs:44, sugar:9, fat:48, kcal:800 },
  { cat:"버거", key:"노브랜드버거 그릴드불고기", aliases:["그릴드불고기","NBB불고기"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:20, carbs:44, sugar:10, fat:20, kcal:440 },
  { cat:"버거", key:"노브랜드버거 치킨버거", aliases:["노브랜드 치킨버거","NBB치킨"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:24, carbs:46, sugar:7, fat:24, kcal:500 },
  { cat:"버거", key:"노브랜드버거 더블패티", aliases:["NBB더블","노브랜드 더블패티"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:34, carbs:42, sugar:8, fat:36, kcal:640 },
  { cat:"버거", key:"노브랜드버거 치즈스테이크", aliases:["치즈스테이크버거","NBB치즈스테이크"], brand:"노브랜드버거", unit:"count", baseQty:1, protein:28, carbs:48, sugar:8, fat:30, kcal:600 },

  // KFC 추가
  { cat:"버거", key:"KFC 타워버거", aliases:["타워버거"], brand:"KFC", unit:"count", baseQty:1, protein:30, carbs:52, sugar:6, fat:32, kcal:640 },
  { cat:"버거", key:"KFC 징거더블다운맥스", aliases:["더블다운","징거더블다운"], brand:"KFC", unit:"count", baseQty:1, protein:38, carbs:12, sugar:2, fat:34, kcal:540 },
  { cat:"버거", key:"KFC 치킨버거", aliases:["KFC 치킨버거"], brand:"KFC", unit:"count", baseQty:1, protein:26, carbs:46, sugar:6, fat:26, kcal:540 },

  // ---- 피자 (1조각 기준, 라지 8등분) ----
  { cat:"피자", key:"도미노 페퍼로니피자", aliases:["페퍼로니피자","도미노","피자"], brand:"도미노", unit:"count", baseQty:1, protein:12, carbs:33, sugar:3, fat:13, kcal:300 },
  { cat:"피자", key:"피자헛 콤비네이션", aliases:["콤비네이션피자","피자헛"], brand:"피자헛", unit:"count", baseQty:1, protein:11, carbs:34, sugar:4, fat:12, kcal:290 },
  { cat:"피자", key:"포테이토피자", aliases:["포테이토피자"], unit:"count", baseQty:1, protein:11, carbs:38, sugar:4, fat:13, kcal:310 },
  { cat:"피자", key:"고구마피자", aliases:["고구마피자"], unit:"count", baseQty:1, protein:10, carbs:42, sugar:10, fat:12, kcal:320 },
  { cat:"피자", key:"불고기피자", aliases:["불고기피자"], unit:"count", baseQty:1, protein:12, carbs:30, sugar:6, fat:10, kcal:265, gramsPerServing:120 },
  { cat:"피자", key:"치즈피자", aliases:["치즈피자","마르게리타"], unit:"count", baseQty:1, protein:11, carbs:29, sugar:3, fat:9, kcal:245, gramsPerServing:110 },
  { cat:"피자", key:"하와이안피자", aliases:["하와이안피자"], unit:"count", baseQty:1, protein:11, carbs:32, sugar:8, fat:9, kcal:255, gramsPerServing:120 },
  { cat:"피자", key:"쉬림프피자", aliases:["쉬림프피자","새우피자"], unit:"count", baseQty:1, protein:12, carbs:30, sugar:5, fat:9, kcal:250, gramsPerServing:120 },
  { cat:"피자", key:"시카고피자", aliases:["시카고피자","딥디쉬"], unit:"count", baseQty:1, protein:15, carbs:34, sugar:5, fat:16, kcal:340, gramsPerServing:150 },

  // ---- 서브웨이 (15cm 기준) ----
  { cat:"빵류", key:"서브웨이 이탈리안비엠티", aliases:["이탈리안비엠티","비엠티","BMT"], brand:"서브웨이", unit:"count", baseQty:1, protein:20, carbs:44, sugar:7, fat:16, kcal:410, gramsPerServing:230 },
  { cat:"빵류", key:"서브웨이 터키", aliases:["서브웨이 터키","터키샌드위치"], brand:"서브웨이", unit:"count", baseQty:1, protein:18, carbs:44, sugar:6, fat:4, kcal:280, gramsPerServing:220 },
  { cat:"빵류", key:"서브웨이 로티세리치킨", aliases:["로티세리","로티세리치킨"], brand:"서브웨이", unit:"count", baseQty:1, protein:29, carbs:43, sugar:6, fat:6, kcal:350, gramsPerServing:240 },
  { cat:"빵류", key:"서브웨이 에그마요", aliases:["에그마요"], brand:"서브웨이", unit:"count", baseQty:1, protein:14, carbs:42, sugar:5, fat:18, kcal:400, gramsPerServing:240 },
  { cat:"빵류", key:"서브웨이 참치", aliases:["서브웨이 참치","참치샌드위치"], brand:"서브웨이", unit:"count", baseQty:1, protein:19, carbs:41, sugar:5, fat:24, kcal:480, gramsPerServing:240 },

  // ---- 편의점 ----
  { cat:"편의점", key:"삼각김밥", aliases:["삼각김밥"], brand:"편의점", unit:"count", baseQty:1, protein:4, carbs:38, sugar:2, fat:4, kcal:200 },
  { cat:"편의점", key:"편의점 김밥", aliases:["편의점 김밥","편의점김밥"], brand:"편의점", unit:"count", baseQty:1, protein:10, carbs:70, sugar:5, fat:12, kcal:450 },
  { cat:"편의점", key:"편의점 도시락", aliases:["편의점 도시락","편의점도시락","도시락"], brand:"편의점", unit:"count", baseQty:1, protein:25, carbs:100, sugar:8, fat:22, kcal:720 },
  { cat:"편의점", key:"컵라면", aliases:["컵라면","육개장 사발면"], brand:"편의점", unit:"count", baseQty:1, protein:7, carbs:55, sugar:4, fat:14, kcal:390 },
  { cat:"편의점", key:"닭가슴살 소시지", aliases:["닭가슴살 소시지","닭가슴살소시지","닭소시지"], brand:"편의점", unit:"count", baseQty:1, protein:14, carbs:3, sugar:1, fat:3, kcal:95 },
  { cat:"편의점", key:"스트링치즈", aliases:["스트링치즈"], brand:"편의점", unit:"count", baseQty:1, protein:6, carbs:1, sugar:0, fat:5, kcal:70 },
  { cat:"편의점", key:"바나나우유", aliases:["바나나우유"], brand:"편의점", unit:"count", baseQty:1, protein:5, carbs:27, sugar:26, fat:5, kcal:180, liquidMl:240 },
  { cat:"편의점", key:"콜라", aliases:["콜라"], unit:"count", baseQty:1, protein:0, carbs:27, sugar:27, fat:0, kcal:108 },
  { cat:"편의점", key:"제로콜라", aliases:["제로콜라","콜라제로","펩시제로"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:0 },
  { cat:"편의점", key:"이온음료", aliases:["포카리","게토레이","이온음료"], unit:"count", baseQty:1, protein:0, carbs:16, sugar:16, fat:0, kcal:62, liquidMl:500 },
  { cat:"편의점", key:"단백질음료", aliases:["단백질음료","셀렉스","프로틴음료","마이밀"], brand:"편의점", unit:"count", baseQty:1, protein:20, carbs:7, sugar:5, fat:2, kcal:130, liquidMl:200 },
  { cat:"편의점", key:"햄버거(편의점)", aliases:["편의점햄버거"], unit:"count", baseQty:1, protein:14, carbs:38, sugar:6, fat:16, kcal:350, gramsPerServing:180 },
  { cat:"편의점", key:"샌드위치(편의점)", aliases:["편의점샌드위치"], unit:"count", baseQty:1, protein:12, carbs:35, sugar:6, fat:12, kcal:300, gramsPerServing:170 },
  { cat:"편의점", key:"핫바", aliases:["핫바","어묵바"], unit:"count", baseQty:1, protein:8, carbs:14, sugar:4, fat:8, kcal:160, gramsPerServing:80 },
  { cat:"편의점", key:"소시지(편의점)", aliases:["편의점소시지"], unit:"count", baseQty:1, protein:7, carbs:6, sugar:2, fat:12, kcal:160, gramsPerServing:70 },
  { cat:"편의점", key:"컵밥", aliases:["컵밥"], unit:"count", baseQty:1, protein:10, carbs:70, sugar:6, fat:10, kcal:400, gramsPerServing:300 },
  { cat:"편의점", key:"즉석국", aliases:["즉석국","컵국"], unit:"count", baseQty:1, protein:5, carbs:8, sugar:3, fat:3, kcal:80, gramsPerServing:300 },
  { cat:"편의점", key:"훈제계란", aliases:["훈제계란","훈제란"], unit:"count", baseQty:1, protein:6.5, carbs:0.5, sugar:0.3, fat:5, kcal:70, gramsPerServing:50 },
  { cat:"편의점", key:"아이스크림바", aliases:["아이스크림바"], unit:"count", baseQty:1, protein:3, carbs:25, sugar:20, fat:8, kcal:180, gramsPerServing:80 },
  { cat:"편의점", key:"젤리", aliases:["젤리","마이구미"], unit:"count", baseQty:1, protein:3, carbs:40, sugar:30, fat:0, kcal:170, gramsPerServing:50 },

  // ---- 카페 (기본 사이즈 기준) ----
  { cat:"카페", key:"아메리카노", aliases:["아메리카노"], brand:"카페", unit:"count", baseQty:1, protein:0.3, carbs:3, sugar:0, fat:0, kcal:10, liquidMl:355 },
  { cat:"카페", key:"카페라떼", aliases:["카페라떼","라떼"], brand:"카페", unit:"count", baseQty:1, protein:7, carbs:12, sugar:12, fat:6, kcal:150, liquidMl:355 },
  { cat:"카페", key:"바닐라라떼", aliases:["바닐라라떼"], brand:"카페", unit:"count", baseQty:1, protein:7, carbs:35, sugar:33, fat:6, kcal:250, liquidMl:355 },
  { cat:"카페", key:"카라멜마끼아또", aliases:["카라멜마끼아또","마끼아또"], brand:"카페", unit:"count", baseQty:1, protein:8, carbs:38, sugar:35, fat:8, kcal:280, liquidMl:355 },
  { cat:"카페", key:"초코우유", aliases:["초코우유"], unit:"count", baseQty:1, protein:6, carbs:22, sugar:20, fat:5, kcal:170, liquidMl:240 },
  { cat:"카페", key:"카푸치노", aliases:["카푸치노"], unit:"count", baseQty:1, protein:6, carbs:10, sugar:9, fat:4, kcal:110, gramsPerServing:355 },
  { cat:"카페", key:"에스프레소", aliases:["에스프레소","샷"], unit:"count", baseQty:1, protein:0.3, carbs:1, sugar:0, fat:0.2, kcal:8, gramsPerServing:30 },
  { cat:"카페", key:"콜드브루", aliases:["콜드브루"], unit:"count", baseQty:1, protein:0.5, carbs:2, sugar:0, fat:0, kcal:15, gramsPerServing:355 },
  { cat:"카페", key:"돌체라떼", aliases:["돌체라떼"], unit:"count", baseQty:1, protein:7, carbs:30, sugar:28, fat:8, kcal:220, gramsPerServing:355 },
  { cat:"카페", key:"그린티라떼", aliases:["그린티라떼","녹차라떼"], unit:"count", baseQty:1, protein:7, carbs:32, sugar:28, fat:6, kcal:210, gramsPerServing:355 },
  { cat:"카페", key:"흑당라떼", aliases:["흑당라떼"], unit:"count", baseQty:1, protein:6, carbs:40, sugar:36, fat:7, kcal:250, gramsPerServing:355 },
  { cat:"카페", key:"자몽에이드", aliases:["자몽에이드","에이드"], unit:"count", baseQty:1, protein:0, carbs:34, sugar:32, fat:0, kcal:140, gramsPerServing:400 },
  { cat:"카페", key:"레모네이드", aliases:["레모네이드"], unit:"count", baseQty:1, protein:0, carbs:32, sugar:30, fat:0, kcal:130, gramsPerServing:400 },
  { cat:"카페", key:"핫초코", aliases:["핫초코","코코아"], unit:"count", baseQty:1, protein:6, carbs:32, sugar:28, fat:6, kcal:200, gramsPerServing:300 },

  // ---- 간식 ----
  { cat:"간식", key:"새우깡", aliases:["새우깡"], unit:"count", baseQty:1, protein:6, carbs:60, sugar:5, fat:18, kcal:460, gramsPerServing:90 },
  { cat:"간식", key:"포카칩", aliases:["포카칩"], unit:"count", baseQty:1, protein:6, carbs:55, sugar:3, fat:28, kcal:480, gramsPerServing:87 },
  { cat:"간식", key:"초코파이", aliases:["초코파이"], unit:"count", baseQty:1, protein:2, carbs:20, sugar:14, fat:5, kcal:140, gramsPerServing:35 },
  { cat:"간식", key:"오레오", aliases:["오레오"], unit:"count", baseQty:1, protein:1, carbs:10, sugar:6, fat:3, kcal:70, gramsPerServing:15 },
  { cat:"간식", key:"프로틴바", aliases:["프로틴바","단백질바"], unit:"count", baseQty:1, protein:20, carbs:22, sugar:3, fat:8, kcal:220, gramsPerServing:50 },
  { cat:"간식", key:"에너지바", aliases:["에너지바"], unit:"count", baseQty:1, protein:8, carbs:35, sugar:15, fat:9, kcal:250, gramsPerServing:45 },
  { cat:"간식", key:"허니버터칩", aliases:["허니버터칩"], unit:"count", baseQty:1, protein:4, carbs:40, sugar:8, fat:22, kcal:360, gramsPerServing:60 },
  { cat:"간식", key:"홈런볼", aliases:["홈런볼"], unit:"count", baseQty:1, protein:3, carbs:25, sugar:14, fat:12, kcal:220, gramsPerServing:46 },
  { cat:"간식", key:"빼빼로", aliases:["빼빼로"], unit:"count", baseQty:1, protein:4, carbs:35, sugar:20, fat:12, kcal:260, gramsPerServing:52 },
  { cat:"간식", key:"초콜릿바", aliases:["초콜릿","가나초콜릿","초코바"], unit:"count", baseQty:1, protein:2, carbs:18, sugar:16, fat:9, kcal:160, gramsPerServing:45 },
  { cat:"간식", key:"아이스크림콘", aliases:["아이스크림","월드콘","붕어싸만코"], unit:"count", baseQty:1, protein:4, carbs:30, sugar:20, fat:12, kcal:250, gramsPerServing:150 },
  { cat:"간식", key:"메로나", aliases:["메로나"], unit:"count", baseQty:1, protein:1, carbs:16, sugar:13, fat:2, kcal:85, gramsPerServing:80 },
  { cat:"간식", key:"마카롱", aliases:["마카롱"], unit:"count", baseQty:1, protein:2, carbs:20, sugar:17, fat:6, kcal:140, gramsPerServing:25 },
  { cat:"간식", key:"소금빵", aliases:["소금빵"], unit:"count", baseQty:1, protein:5, carbs:30, sugar:3, fat:14, kcal:270, gramsPerServing:80 },
  { cat:"간식", key:"크로플", aliases:["크로플"], unit:"count", baseQty:1, protein:5, carbs:35, sugar:12, fat:18, kcal:330, gramsPerServing:100 },
  { cat:"간식", key:"붕어빵", aliases:["붕어빵"], unit:"count", baseQty:1, protein:3, carbs:22, sugar:9, fat:2, kcal:120, gramsPerServing:70 },
  { cat:"간식", key:"약과", aliases:["약과"], unit:"count", baseQty:1, protein:1, carbs:20, sugar:12, fat:6, kcal:140, gramsPerServing:40 },

  // ---- 분식 (1인분 기준) ----
  { cat:"분식", key:"라볶이", aliases:["라볶이"], unit:"count", baseQty:1, protein:14, carbs:95, sugar:18, fat:16, kcal:600 },
  { cat:"분식", key:"쫄면", aliases:["쫄면"], unit:"count", baseQty:1, protein:10, carbs:85, sugar:15, fat:6, kcal:450 },
  { cat:"분식", key:"잔치국수", aliases:["잔치국수"], unit:"count", baseQty:1, protein:12, carbs:75, sugar:4, fat:5, kcal:400 },
  { cat:"분식", key:"비빔국수", aliases:["비빔국수"], unit:"count", baseQty:1, protein:11, carbs:88, sugar:16, fat:7, kcal:480 },
  { cat:"분식", key:"김치볶음밥", aliases:["김치볶음밥"], unit:"count", baseQty:1, protein:12, carbs:80, sugar:5, fat:16, kcal:540 },
  { cat:"분식", key:"참치김밥", aliases:["참치김밥"], unit:"count", baseQty:1, protein:12, carbs:58, sugar:4, fat:14, kcal:420 },
  { cat:"분식", key:"치즈김밥", aliases:["치즈김밥"], unit:"count", baseQty:1, protein:11, carbs:57, sugar:4, fat:12, kcal:400 },
  { cat:"분식", key:"만두", aliases:["만두","군만두","찐만두"], unit:"count", baseQty:1, protein:3, carbs:9, sugar:1, fat:3, kcal:70 },
  { cat:"분식", key:"떡국", aliases:["떡국"], unit:"count", baseQty:1, protein:14, carbs:80, sugar:3, fat:8, kcal:470 },
  { cat:"분식", key:"수제비", aliases:["수제비"], unit:"count", baseQty:1, protein:12, carbs:70, sugar:3, fat:6, kcal:400 },
  { cat:"분식", key:"김말이", aliases:["김말이","김말이튀김"], unit:"count", baseQty:1, protein:3, carbs:22, sugar:1, fat:10, kcal:190, gramsPerServing:60 },
  { cat:"분식", key:"치즈떡볶이", aliases:["치즈떡볶이"], unit:"count", baseQty:1, protein:14, carbs:72, sugar:18, fat:16, kcal:510, gramsPerServing:400 },
  { cat:"분식", key:"로제떡볶이", aliases:["로제떡볶이"], unit:"count", baseQty:1, protein:12, carbs:74, sugar:20, fat:18, kcal:530, gramsPerServing:400 },
  { cat:"분식", key:"야채김밥", aliases:["야채김밥"], unit:"count", baseQty:1, protein:8, carbs:62, sugar:5, fat:8, kcal:360, gramsPerServing:230 },
  { cat:"분식", key:"소고기김밥", aliases:["소고기김밥"], unit:"count", baseQty:1, protein:14, carbs:64, sugar:6, fat:10, kcal:420, gramsPerServing:250 },
  { cat:"분식", key:"돈까스김밥", aliases:["돈까스김밥"], unit:"count", baseQty:1, protein:15, carbs:70, sugar:6, fat:16, kcal:490, gramsPerServing:260 },
  { cat:"분식", key:"컵떡볶이", aliases:["컵떡볶이"], unit:"count", baseQty:1, protein:5, carbs:45, sugar:12, fat:5, kcal:260, gramsPerServing:200 },

  // ---- 중식 (1인분 기준) ----
  { cat:"중식", key:"탕수육", aliases:["탕수육"], unit:"count", baseQty:1, protein:22, carbs:60, sugar:25, fat:30, kcal:600 },
  { cat:"중식", key:"마파두부덮밥", aliases:["마파두부"], unit:"count", baseQty:1, protein:20, carbs:85, sugar:8, fat:20, kcal:600 },
  { cat:"중식", key:"유린기", aliases:["유린기"], unit:"count", baseQty:1, protein:28, carbs:35, sugar:12, fat:25, kcal:500 },
  { cat:"중식", key:"깐풍기", aliases:["깐풍기"], unit:"count", baseQty:1, protein:28, carbs:45, sugar:18, fat:28, kcal:580 },
  { cat:"중식", key:"양장피", aliases:["양장피"], unit:"count", baseQty:1, protein:25, carbs:30, sugar:8, fat:18, kcal:420 },
  { cat:"중식", key:"중화비빔밥", aliases:["중화비빔밥"], unit:"count", baseQty:1, protein:18, carbs:95, sugar:8, fat:22, kcal:680 },
  { cat:"중식", key:"울면", aliases:["울면"], unit:"count", baseQty:1, protein:18, carbs:80, sugar:6, fat:12, kcal:520 },
  { cat:"중식", key:"고추잡채", aliases:["고추잡채"], unit:"count", baseQty:1, protein:20, carbs:25, sugar:8, fat:18, kcal:380 },
  { cat:"중식", key:"볶음밥(중식)", aliases:["중국집볶음밥"], unit:"count", baseQty:1, protein:14, carbs:88, sugar:6, fat:18, kcal:590, gramsPerServing:450 },
  { cat:"중식", key:"깐쇼새우", aliases:["깐쇼새우"], unit:"count", baseQty:1, protein:22, carbs:40, sugar:18, fat:20, kcal:430, gramsPerServing:250 },
  { cat:"중식", key:"멘보샤", aliases:["멘보샤"], unit:"count", baseQty:1, protein:16, carbs:30, sugar:4, fat:26, kcal:410, gramsPerServing:180 },
  { cat:"중식", key:"마라샹궈", aliases:["마라샹궈"], unit:"count", baseQty:1, protein:24, carbs:35, sugar:6, fat:32, kcal:530, gramsPerServing:500 },
  { cat:"중식", key:"꿔바로우", aliases:["꿔바로우","찹쌀탕수육"], unit:"count", baseQty:1, protein:18, carbs:55, sugar:22, fat:24, kcal:500, gramsPerServing:300 },
  { cat:"중식", key:"동파육", aliases:["동파육"], unit:"count", baseQty:1, protein:20, carbs:12, sugar:10, fat:38, kcal:470, gramsPerServing:200 },
  { cat:"중식", key:"게살볶음밥", aliases:["게살볶음밥"], unit:"count", baseQty:1, protein:16, carbs:85, sugar:5, fat:16, kcal:570, gramsPerServing:450 },

  // ---- 일식 (1인분 기준) ----
  { cat:"일식", key:"초밥", aliases:["초밥","스시"], unit:"count", baseQty:1, protein:24, carbs:90, sugar:8, fat:8, kcal:520 },
  { cat:"일식", key:"연어초밥", aliases:["연어초밥"], unit:"count", baseQty:1, protein:26, carbs:88, sugar:8, fat:14, kcal:570 },
  { cat:"일식", key:"규동", aliases:["규동","소고기덮밥"], unit:"count", baseQty:1, protein:24, carbs:95, sugar:12, fat:18, kcal:650 },
  { cat:"일식", key:"가츠동", aliases:["가츠동","돈까스덮밥"], unit:"count", baseQty:1, protein:26, carbs:100, sugar:10, fat:28, kcal:750 },
  { cat:"일식", key:"텐동", aliases:["텐동","튀김덮밥"], unit:"count", baseQty:1, protein:18, carbs:105, sugar:8, fat:26, kcal:720 },
  { cat:"일식", key:"라멘", aliases:["라멘"], unit:"count", baseQty:1, protein:22, carbs:80, sugar:6, fat:24, kcal:600 },
  { cat:"일식", key:"우나기동", aliases:["우나기동","장어덮밥"], unit:"count", baseQty:1, protein:28, carbs:95, sugar:12, fat:22, kcal:700 },
  { cat:"일식", key:"오야꼬동", aliases:["오야꼬동","닭고기덮밥"], unit:"count", baseQty:1, protein:28, carbs:90, sugar:10, fat:16, kcal:620 },
  { cat:"일식", key:"소바", aliases:["소바","메밀국수"], unit:"count", baseQty:1, protein:14, carbs:70, sugar:4, fat:3, kcal:380 },
  { cat:"일식", key:"연어사시미", aliases:["연어사시미","사시미","회"], unit:"count", baseQty:1, protein:30, carbs:0, sugar:0, fat:18, kcal:280 },
  { cat:"일식", key:"돈코츠라멘", aliases:["돈코츠라멘","돈코츠"], unit:"count", baseQty:1, protein:24, carbs:70, sugar:5, fat:22, kcal:580, gramsPerServing:700 },
  { cat:"일식", key:"미소라멘", aliases:["미소라멘"], unit:"count", baseQty:1, protein:20, carbs:68, sugar:6, fat:18, kcal:520, gramsPerServing:700 },
  { cat:"일식", key:"냉소바", aliases:["냉소바","자루소바"], unit:"count", baseQty:1, protein:14, carbs:62, sugar:4, fat:2, kcal:340, gramsPerServing:400 },
  { cat:"일식", key:"가라아게", aliases:["가라아게","닭가라아게"], unit:"count", baseQty:1, protein:20, carbs:18, sugar:2, fat:18, kcal:310, gramsPerServing:150 },
  { cat:"일식", key:"치킨카츠", aliases:["치킨카츠","치킨까스"], unit:"count", baseQty:1, protein:28, carbs:32, sugar:3, fat:22, kcal:440, gramsPerServing:250 },
  { cat:"일식", key:"회덮밥", aliases:["회덮밥"], unit:"count", baseQty:1, protein:28, carbs:80, sugar:8, fat:10, kcal:520, gramsPerServing:450 },
  { cat:"일식", key:"타코야끼", aliases:["타코야끼"], unit:"count", baseQty:1, protein:8, carbs:30, sugar:4, fat:12, kcal:260, gramsPerServing:120 },
  { cat:"일식", key:"오코노미야끼", aliases:["오코노미야끼"], unit:"count", baseQty:1, protein:14, carbs:45, sugar:8, fat:18, kcal:390, gramsPerServing:300 },
  { cat:"일식", key:"우동(일식)", aliases:["일식우동"], unit:"count", baseQty:1, protein:12, carbs:76, sugar:4, fat:5, kcal:400, gramsPerServing:550 },
  { cat:"일식", key:"모밀소바", aliases:["모밀소바"], unit:"count", baseQty:1, protein:13, carbs:60, sugar:3, fat:2, kcal:330, gramsPerServing:400 },

  // ---- 아시안 (1인분 기준) ----
  { cat:"아시안", key:"팟타이", aliases:["팟타이"], unit:"count", baseQty:1, protein:18, carbs:85, sugar:15, fat:16, kcal:580 },
  { cat:"아시안", key:"나시고랭", aliases:["나시고랭"], unit:"count", baseQty:1, protein:16, carbs:90, sugar:8, fat:18, kcal:600 },
  { cat:"아시안", key:"분짜", aliases:["분짜"], unit:"count", baseQty:1, protein:24, carbs:70, sugar:12, fat:14, kcal:520 },
  { cat:"아시안", key:"카오팟", aliases:["카오팟","태국볶음밥"], unit:"count", baseQty:1, protein:16, carbs:88, sugar:6, fat:16, kcal:570 },
  { cat:"아시안", key:"똠얌꿍", aliases:["똠얌꿍"], unit:"count", baseQty:1, protein:18, carbs:20, sugar:6, fat:10, kcal:250 },
  { cat:"아시안", key:"반미", aliases:["반미"], unit:"count", baseQty:1, protein:18, carbs:55, sugar:8, fat:16, kcal:440 },
  { cat:"아시안", key:"월남쌈", aliases:["월남쌈","고이꾸언"], unit:"count", baseQty:1, protein:14, carbs:35, sugar:6, fat:5, kcal:250 },
  { cat:"아시안", key:"팟씨유", aliases:["팟씨유"], unit:"count", baseQty:1, protein:16, carbs:72, sugar:10, fat:16, kcal:500, gramsPerServing:400 },
  { cat:"아시안", key:"그린커리", aliases:["그린커리","태국카레"], unit:"count", baseQty:1, protein:18, carbs:22, sugar:8, fat:24, kcal:380, gramsPerServing:350 },
  { cat:"아시안", key:"마사만커리", aliases:["마사만커리"], unit:"count", baseQty:1, protein:20, carbs:28, sugar:10, fat:26, kcal:430, gramsPerServing:350 },
  { cat:"아시안", key:"커리(인도)", aliases:["인도커리","버터치킨"], unit:"count", baseQty:1, protein:24, carbs:20, sugar:8, fat:26, kcal:420, gramsPerServing:350 },
  { cat:"아시안", key:"난", aliases:["난","인도난"], unit:"count", baseQty:1, protein:8, carbs:45, sugar:3, fat:6, kcal:260, gramsPerServing:90 },
  { cat:"아시안", key:"사테", aliases:["사테","꼬치사테"], unit:"count", baseQty:1, protein:20, carbs:8, sugar:5, fat:12, kcal:220, gramsPerServing:120 },
  { cat:"아시안", key:"스프링롤", aliases:["스프링롤","짜조"], unit:"count", baseQty:1, protein:6, carbs:22, sugar:3, fat:10, kcal:190, gramsPerServing:100 },

  // ---- 샐러드·건강식 (1인분 기준) ----
  { cat:"샐러드·건강식", key:"포케", aliases:["포케","포케볼"], unit:"count", baseQty:1, protein:28, carbs:55, sugar:8, fat:14, kcal:450 },
  { cat:"샐러드·건강식", key:"닭가슴살 도시락", aliases:["닭가슴살 도시락","닭가슴살도시락"], unit:"count", baseQty:1, protein:35, carbs:45, sugar:5, fat:8, kcal:400 },
  { cat:"샐러드·건강식", key:"프로틴 도시락", aliases:["프로틴 도시락","프로틴도시락"], unit:"count", baseQty:1, protein:40, carbs:50, sugar:6, fat:10, kcal:450 },
  { cat:"샐러드·건강식", key:"오트밀볼", aliases:["오트밀볼","오버나이트오트밀"], unit:"count", baseQty:1, protein:15, carbs:50, sugar:15, fat:10, kcal:350 },
  { cat:"샐러드·건강식", key:"연어 포케", aliases:["연어포케","연어 포케"], unit:"count", baseQty:1, protein:26, carbs:50, sugar:8, fat:18, kcal:470 },
  { cat:"샐러드·건강식", key:"두부 샐러드", aliases:["두부샐러드","두부 샐러드"], unit:"count", baseQty:1, protein:18, carbs:15, sugar:6, fat:12, kcal:260 },
  { cat:"샐러드·건강식", key:"과일 샐러드", aliases:["과일샐러드","과일 샐러드"], unit:"count", baseQty:1, protein:2, carbs:30, sugar:24, fat:2, kcal:150 },
  { cat:"샐러드·건강식", key:"시저샐러드", aliases:["시저샐러드"], unit:"count", baseQty:1, protein:12, carbs:12, sugar:4, fat:20, kcal:280, gramsPerServing:250 },
  { cat:"샐러드·건강식", key:"그릭샐러드", aliases:["그릭샐러드"], unit:"count", baseQty:1, protein:8, carbs:10, sugar:5, fat:16, kcal:220, gramsPerServing:250 },
  { cat:"샐러드·건강식", key:"닭가슴살 샐러드볼", aliases:["닭가슴살볼"], unit:"count", baseQty:1, protein:30, carbs:25, sugar:6, fat:10, kcal:320, gramsPerServing:350 },
  { cat:"샐러드·건강식", key:"연어 샐러드", aliases:["연어샐러드"], unit:"count", baseQty:1, protein:26, carbs:12, sugar:5, fat:18, kcal:330, gramsPerServing:300 },
  { cat:"샐러드·건강식", key:"퀴노아볼", aliases:["퀴노아볼","퀴노아샐러드"], unit:"count", baseQty:1, protein:14, carbs:45, sugar:6, fat:12, kcal:350, gramsPerServing:300 },
  { cat:"샐러드·건강식", key:"아사이볼", aliases:["아사이볼"], unit:"count", baseQty:1, protein:6, carbs:55, sugar:30, fat:10, kcal:320, gramsPerServing:300 },
  { cat:"샐러드·건강식", key:"스무디볼", aliases:["스무디볼"], unit:"count", baseQty:1, protein:8, carbs:50, sugar:32, fat:8, kcal:300, gramsPerServing:300 },
  { cat:"샐러드·건강식", key:"병아리콩샐러드", aliases:["병아리콩샐러드"], unit:"count", baseQty:1, protein:12, carbs:35, sugar:6, fat:10, kcal:280, gramsPerServing:250 },

  // ---- 빵류 (1개 기준) ----
  { cat:"빵류", key:"크루아상", aliases:["크루아상"], unit:"count", baseQty:1, protein:5, carbs:26, sugar:6, fat:14, kcal:250, gramsPerServing:60 },
  { cat:"빵류", key:"단팥빵", aliases:["단팥빵"], unit:"count", baseQty:1, protein:6, carbs:50, sugar:22, fat:6, kcal:280, gramsPerServing:90 },
  { cat:"빵류", key:"크림빵", aliases:["크림빵"], unit:"count", baseQty:1, protein:6, carbs:48, sugar:20, fat:10, kcal:310, gramsPerServing:90 },
  { cat:"빵류", key:"소보로빵", aliases:["소보로빵","곰보빵"], unit:"count", baseQty:1, protein:6, carbs:52, sugar:18, fat:12, kcal:330, gramsPerServing:90 },
  { cat:"빵류", key:"모닝빵", aliases:["모닝빵"], unit:"count", baseQty:1, protein:3, carbs:18, sugar:3, fat:2, kcal:100, gramsPerServing:30 },
  { cat:"빵류", key:"바게트", aliases:["바게트"], unit:"count", baseQty:1, protein:3, carbs:15, sugar:0, fat:0.5, kcal:80, gramsPerServing:250 },
  { cat:"빵류", key:"치아바타", aliases:["치아바타"], unit:"count", baseQty:1, protein:9, carbs:52, sugar:2, fat:4, kcal:270, gramsPerServing:100 },
  { cat:"빵류", key:"에그샌드위치", aliases:["에그샌드위치","계란샌드위치"], unit:"count", baseQty:1, protein:14, carbs:35, sugar:5, fat:18, kcal:360, gramsPerServing:180 },
  { cat:"빵류", key:"클럽샌드위치", aliases:["클럽샌드위치"], unit:"count", baseQty:1, protein:24, carbs:40, sugar:6, fat:20, kcal:450, gramsPerServing:250 },
  { cat:"빵류", key:"식빵(빵류)", aliases:["식빵 1장"], unit:"count", baseQty:1, protein:3, carbs:15, sugar:1.5, fat:1, kcal:80, gramsPerServing:35 },
  { cat:"빵류", key:"통밀식빵", aliases:["통밀식빵"], unit:"count", baseQty:1, protein:4, carbs:14, sugar:1.5, fat:1.5, kcal:85, gramsPerServing:35 },
  { cat:"빵류", key:"베이글(빵류)", aliases:["베이글 1개"], unit:"count", baseQty:1, protein:10, carbs:55, sugar:5, fat:2, kcal:280, gramsPerServing:100 },
  { cat:"빵류", key:"햄치즈샌드위치", aliases:["햄치즈샌드위치"], unit:"count", baseQty:1, protein:16, carbs:34, sugar:5, fat:14, kcal:330, gramsPerServing:180 },
  { cat:"빵류", key:"BLT샌드위치", aliases:["BLT","BLT샌드위치"], unit:"count", baseQty:1, protein:14, carbs:36, sugar:5, fat:16, kcal:350, gramsPerServing:190 },
  { cat:"빵류", key:"치아바타샌드위치", aliases:["치아바타샌드"], unit:"count", baseQty:1, protein:18, carbs:42, sugar:5, fat:14, kcal:370, gramsPerServing:200 },
  { cat:"빵류", key:"마늘바게트", aliases:["마늘바게트","마늘빵"], unit:"count", baseQty:1, protein:5, carbs:30, sugar:4, fat:10, kcal:230, gramsPerServing:70 },
  { cat:"빵류", key:"소금빵(빵류)", aliases:["소금빵 1개"], unit:"count", baseQty:1, protein:5, carbs:32, sugar:4, fat:12, kcal:250, gramsPerServing:80 },
  { cat:"빵류", key:"피자빵", aliases:["피자빵"], unit:"count", baseQty:1, protein:9, carbs:38, sugar:6, fat:12, kcal:290, gramsPerServing:110 },
  { cat:"빵류", key:"햄버거번", aliases:["햄버거번","번"], unit:"count", baseQty:1, protein:5, carbs:28, sugar:4, fat:3, kcal:160, gramsPerServing:60 },
  { cat:"빵류", key:"또띠아", aliases:["또띠아","토르티야"], unit:"count", baseQty:1, protein:4, carbs:26, sugar:1, fat:4, kcal:150, gramsPerServing:50 },
  { cat:"빵류", key:"프레첼", aliases:["프레첼"], unit:"count", baseQty:1, protein:6, carbs:46, sugar:3, fat:3, kcal:240, gramsPerServing:70 },
  { cat:"빵류", key:"맘모스빵", aliases:["맘모스빵"], unit:"count", baseQty:1, protein:8, carbs:62, sugar:22, fat:18, kcal:440, gramsPerServing:130 },
  { cat:"빵류", key:"고로케", aliases:["고로케","야채고로케"], unit:"count", baseQty:1, protein:6, carbs:32, sugar:4, fat:14, kcal:270, gramsPerServing:90 },
  { cat:"빵류", key:"카스테라", aliases:["카스테라","카스테라빵"], unit:"count", baseQty:1, protein:6, carbs:40, sugar:22, fat:8, kcal:250, gramsPerServing:80 },
  { cat:"빵류", key:"밤식빵", aliases:["밤식빵"], unit:"count", baseQty:1, protein:6, carbs:45, sugar:15, fat:8, kcal:280, gramsPerServing:100 },
  { cat:"빵류", key:"옥수수빵", aliases:["옥수수빵"], unit:"count", baseQty:1, protein:6, carbs:42, sugar:12, fat:9, kcal:270, gramsPerServing:100 },
  { cat:"빵류", key:"치즈빵", aliases:["치즈빵"], unit:"count", baseQty:1, protein:9, carbs:38, sugar:6, fat:12, kcal:290, gramsPerServing:100 },
  { cat:"빵류", key:"마늘크림빵", aliases:["마늘크림빵","마늘바게트빵"], unit:"count", baseQty:1, protein:7, carbs:42, sugar:10, fat:16, kcal:340, gramsPerServing:110 },
  { cat:"빵류", key:"팥빵", aliases:["팥빵","앙금빵"], unit:"count", baseQty:1, protein:7, carbs:55, sugar:24, fat:6, kcal:300, gramsPerServing:100 },
  { cat:"빵류", key:"슈크림빵", aliases:["슈크림빵","슈크림"], unit:"count", baseQty:1, protein:7, carbs:42, sugar:20, fat:14, kcal:330, gramsPerServing:100 },
  { cat:"빵류", key:"초코빵", aliases:["초코빵","초코소라빵"], unit:"count", baseQty:1, protein:6, carbs:45, sugar:22, fat:14, kcal:340, gramsPerServing:100 },
  { cat:"빵류", key:"도넛빵", aliases:["꽈배기","도넛꽈배기"], unit:"count", baseQty:1, protein:5, carbs:40, sugar:14, fat:14, kcal:320, gramsPerServing:80 },
  { cat:"빵류", key:"베이글 플레인", aliases:["플레인베이글"], unit:"count", baseQty:1, protein:10, carbs:53, sugar:4, fat:2, kcal:270, gramsPerServing:95 },
  { cat:"빵류", key:"블루베리베이글", aliases:["블루베리베이글"], unit:"count", baseQty:1, protein:9, carbs:58, sugar:12, fat:2, kcal:290, gramsPerServing:100 },
  { cat:"빵류", key:"치즈베이글", aliases:["치즈베이글"], unit:"count", baseQty:1, protein:12, carbs:54, sugar:5, fat:6, kcal:320, gramsPerServing:105 },
  { cat:"빵류", key:"깜빠뉴", aliases:["깜빠뉴","캉파뉴"], unit:"count", baseQty:1, protein:8, carbs:48, sugar:2, fat:2, kcal:250, gramsPerServing:90 },
  { cat:"빵류", key:"사워도우", aliases:["사워도우"], unit:"count", baseQty:1, protein:8, carbs:46, sugar:2, fat:1.5, kcal:240, gramsPerServing:90 },
  { cat:"빵류", key:"포카치아", aliases:["포카치아"], unit:"count", baseQty:1, protein:7, carbs:44, sugar:2, fat:10, kcal:300, gramsPerServing:100 },
  { cat:"빵류", key:"프레첼빵", aliases:["프레첼번"], unit:"count", baseQty:1, protein:8, carbs:50, sugar:4, fat:4, kcal:270, gramsPerServing:90 },
  { cat:"빵류", key:"브리오슈", aliases:["브리오슈"], unit:"count", baseQty:1, protein:7, carbs:40, sugar:10, fat:14, kcal:320, gramsPerServing:85 },
  { cat:"빵류", key:"팽오쇼콜라", aliases:["팽오쇼콜라","초코크루아상"], unit:"count", baseQty:1, protein:6, carbs:36, sugar:12, fat:18, kcal:340, gramsPerServing:80 },
  { cat:"빵류", key:"크로크무슈", aliases:["크로크무슈"], unit:"count", baseQty:1, protein:20, carbs:34, sugar:5, fat:22, kcal:420, gramsPerServing:180 },
  { cat:"빵류", key:"치아바타빵", aliases:["치아바타 1개"], unit:"count", baseQty:1, protein:9, carbs:52, sugar:2, fat:3, kcal:270, gramsPerServing:100 },
  { cat:"빵류", key:"프렌치바게트", aliases:["프렌치바게트"], unit:"count", baseQty:1, protein:9, carbs:55, sugar:2, fat:1.5, kcal:270, gramsPerServing:100 },
  { cat:"빵류", key:"치킨샌드위치", aliases:["치킨샌드위치"], unit:"count", baseQty:1, protein:22, carbs:36, sugar:5, fat:14, kcal:360, gramsPerServing:200 },
  { cat:"빵류", key:"불고기샌드위치", aliases:["불고기샌드위치"], unit:"count", baseQty:1, protein:20, carbs:38, sugar:8, fat:14, kcal:360, gramsPerServing:200 },
  { cat:"빵류", key:"햄치즈토스트", aliases:["햄치즈토스트"], unit:"count", baseQty:1, protein:16, carbs:32, sugar:5, fat:15, kcal:330, gramsPerServing:150 },
  { cat:"빵류", key:"잼토스트", aliases:["잼토스트"], unit:"count", baseQty:1, protein:5, carbs:38, sugar:16, fat:6, kcal:220, gramsPerServing:80 },
  { cat:"빵류", key:"버터토스트", aliases:["버터토스트"], unit:"count", baseQty:1, protein:4, carbs:30, sugar:3, fat:12, kcal:250, gramsPerServing:70 },
  { cat:"빵류", key:"핫도그빵", aliases:["핫도그빵","핫도그번"], unit:"count", baseQty:1, protein:5, carbs:30, sugar:4, fat:3, kcal:170, gramsPerServing:60 },
  { cat:"빵류", key:"난(빵류)", aliases:["난 1장"], unit:"count", baseQty:1, protein:8, carbs:45, sugar:3, fat:6, kcal:260, gramsPerServing:90 },
  { cat:"빵류", key:"피타브레드", aliases:["피타","피타브레드"], unit:"count", baseQty:1, protein:6, carbs:33, sugar:1, fat:1, kcal:165, gramsPerServing:60 },
  { cat:"빵류", key:"모닝롤", aliases:["모닝롤","버터롤"], unit:"count", baseQty:1, protein:5, carbs:28, sugar:5, fat:6, kcal:190, gramsPerServing:60 },
  { cat:"빵류", key:"우유식빵", aliases:["우유식빵"], unit:"count", baseQty:1, protein:4, carbs:16, sugar:3, fat:2, kcal:100, gramsPerServing:40 },
  { cat:"빵류", key:"호밀빵", aliases:["호밀빵","라이브레드"], unit:"count", baseQty:1, protein:5, carbs:30, sugar:2, fat:1.5, kcal:160, gramsPerServing:60 },

  // ---- 음료 (1잔/1캔 기준) ----
  { cat:"음료", key:"제로사이다", aliases:["제로사이다","사이다제로"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:0, liquidMl:355 },
  { cat:"음료", key:"사이다", aliases:["사이다"], unit:"count", baseQty:1, protein:0, carbs:27, sugar:27, fat:0, kcal:100, liquidMl:355 },
  { cat:"음료", key:"콤부차", aliases:["콤부차"], unit:"count", baseQty:1, protein:0, carbs:8, sugar:6, fat:0, kcal:35, liquidMl:300 },
  { cat:"음료", key:"스무디", aliases:["스무디"], unit:"count", baseQty:1, protein:3, carbs:45, sugar:38, fat:2, kcal:210, liquidMl:400 },
  { cat:"음료", key:"아이스티", aliases:["아이스티","복숭아아이스티"], unit:"count", baseQty:1, protein:0, carbs:30, sugar:28, fat:0, kcal:120, liquidMl:400 },
  { cat:"음료", key:"에너지드링크", aliases:["에너지드링크","핫식스","몬스터"], unit:"count", baseQty:1, protein:0, carbs:28, sugar:27, fat:0, kcal:110, liquidMl:250 },
  { cat:"음료", key:"제로에너지드링크", aliases:["몬스터제로","에너지드링크제로"], unit:"count", baseQty:1, protein:0, carbs:2, sugar:0, fat:0, kcal:10, liquidMl:250 },
  { cat:"음료", key:"오렌지주스", aliases:["오렌지주스"], unit:"count", baseQty:1, protein:2, carbs:26, sugar:22, fat:0, kcal:110, liquidMl:200 },
  { cat:"음료", key:"보리차", aliases:["보리차"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:0, gramsPerServing:500 },
  { cat:"음료", key:"탄산수", aliases:["탄산수","스파클링워터"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:0, gramsPerServing:500 },
  { cat:"음료", key:"포도주스", aliases:["포도주스"], unit:"count", baseQty:1, protein:0.5, carbs:36, sugar:34, fat:0, kcal:150, gramsPerServing:250 },
  { cat:"음료", key:"토마토주스", aliases:["토마토주스"], unit:"count", baseQty:1, protein:2, carbs:10, sugar:8, fat:0, kcal:45, gramsPerServing:250 },
  { cat:"음료", key:"식혜", aliases:["식혜"], unit:"count", baseQty:1, protein:1, carbs:40, sugar:32, fat:0, kcal:165, gramsPerServing:250 },
  { cat:"음료", key:"수정과", aliases:["수정과"], unit:"count", baseQty:1, protein:0.2, carbs:34, sugar:30, fat:0, kcal:135, gramsPerServing:250 },
  { cat:"음료", key:"밀크티", aliases:["밀크티","버블티"], unit:"count", baseQty:1, protein:4, carbs:45, sugar:38, fat:6, kcal:250, gramsPerServing:400 },
  { cat:"음료", key:"코코넛워터", aliases:["코코넛워터"], unit:"count", baseQty:1, protein:1, carbs:14, sugar:12, fat:0, kcal:60, gramsPerServing:330 },
  { cat:"음료", key:"사과주스", aliases:["사과주스"], unit:"count", baseQty:1, protein:0.3, carbs:28, sugar:26, fat:0, kcal:115, gramsPerServing:250 },

  // ---- 반찬·야채 (1인분/한 접시 기준) ----
  { cat:"반찬·야채", key:"장조림", aliases:["장조림","소고기장조림"], unit:"count", baseQty:1, protein:15, carbs:6, sugar:4, fat:5, kcal:130 },
  { cat:"반찬·야채", key:"계란찜", aliases:["계란찜","달걀찜"], unit:"count", baseQty:1, protein:13, carbs:3, sugar:1, fat:9, kcal:150 },
  { cat:"반찬·야채", key:"계란말이", aliases:["계란말이","달걀말이"], unit:"count", baseQty:1, protein:12, carbs:3, sugar:1, fat:12, kcal:170 },
  { cat:"반찬·야채", key:"콩나물무침", aliases:["콩나물","콩나물무침"], unit:"count", baseQty:1, protein:3, carbs:5, sugar:1, fat:3, kcal:60 },
  { cat:"반찬·야채", key:"시금치나물", aliases:["시금치","시금치나물"], unit:"count", baseQty:1, protein:3, carbs:4, sugar:1, fat:3, kcal:55 },
  { cat:"반찬·야채", key:"멸치볶음", aliases:["멸치볶음","멸치"], unit:"count", baseQty:1, protein:9, carbs:8, sugar:5, fat:5, kcal:120 },
  { cat:"반찬·야채", key:"어묵볶음", aliases:["어묵볶음"], unit:"count", baseQty:1, protein:7, carbs:12, sugar:4, fat:6, kcal:130 },
  { cat:"반찬·야채", key:"진미채무침", aliases:["진미채","진미채무침","오징어채"], unit:"count", baseQty:1, protein:10, carbs:12, sugar:8, fat:5, kcal:140 },
  { cat:"반찬·야채", key:"김치", aliases:["김치","배추김치"], unit:"count", baseQty:1, protein:1, carbs:4, sugar:2, fat:0.3, kcal:25 },
  { cat:"반찬·야채", key:"깍두기", aliases:["깍두기"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:3, fat:0.2, kcal:30 },
  { cat:"반찬·야채", key:"오이무침", aliases:["오이무침","오이"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:3, fat:2, kcal:45 },
  { cat:"반찬·야채", key:"무생채", aliases:["무생채","무채"], unit:"count", baseQty:1, protein:1, carbs:6, sugar:3, fat:2, kcal:45 },
  { cat:"반찬·야채", key:"애호박볶음", aliases:["애호박볶음","호박볶음"], unit:"count", baseQty:1, protein:2, carbs:6, sugar:3, fat:4, kcal:70 },
  { cat:"반찬·야채", key:"가지볶음", aliases:["가지볶음","가지"], unit:"count", baseQty:1, protein:2, carbs:7, sugar:4, fat:5, kcal:80 },
  { cat:"반찬·야채", key:"버섯볶음", aliases:["버섯볶음","버섯"], unit:"count", baseQty:1, protein:3, carbs:6, sugar:2, fat:4, kcal:70 },
  { cat:"반찬·야채", key:"두부조림", aliases:["두부조림"], unit:"count", baseQty:1, protein:11, carbs:6, sugar:3, fat:8, kcal:150 },
  { cat:"반찬·야채", key:"감자조림", aliases:["감자조림"], unit:"count", baseQty:1, protein:2, carbs:22, sugar:6, fat:3, kcal:130 },
  { cat:"반찬·야채", key:"연근조림", aliases:["연근조림","연근"], unit:"count", baseQty:1, protein:2, carbs:20, sugar:9, fat:2, kcal:110 },
  { cat:"반찬·야채", key:"우엉조림", aliases:["우엉조림","우엉"], unit:"count", baseQty:1, protein:2, carbs:18, sugar:8, fat:2, kcal:100 },
  { cat:"반찬·야채", key:"메추리알장조림", aliases:["메추리알장조림","메추리알"], unit:"count", baseQty:1, protein:12, carbs:5, sugar:3, fat:9, kcal:150 },
  { cat:"반찬·야채", key:"김", aliases:["조미김","김"], unit:"count", baseQty:1, protein:1, carbs:1, sugar:0, fat:1, kcal:20 },
  { cat:"반찬·야채", key:"나물비빔", aliases:["나물","나물반찬"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:1, fat:3, kcal:55 },
  { cat:"반찬·야채", key:"브로콜리무침", aliases:["브로콜리무침"], unit:"count", baseQty:1, protein:3, carbs:6, sugar:2, fat:3, kcal:60 },
  { cat:"반찬·야채", key:"양배추찜", aliases:["양배추찜","양배추"], unit:"count", baseQty:1, protein:2, carbs:8, sugar:5, fat:0.3, kcal:45 },
  { cat:"반찬·야채", key:"단무지", aliases:["단무지"], unit:"count", baseQty:1, protein:0.5, carbs:6, sugar:5, fat:0, kcal:25 },
  { cat:"반찬·야채", key:"고사리나물", aliases:["고사리","고사리나물"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:1, fat:3, kcal:55 },
  { cat:"반찬·야채", key:"도라지무침", aliases:["도라지","도라지무침"], unit:"count", baseQty:1, protein:2, carbs:9, sugar:3, fat:3, kcal:70 },
  { cat:"반찬·야채", key:"파김치", aliases:["파김치"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:2, fat:0.3, kcal:30 },
  { cat:"반찬·야채", key:"제육볶음(반찬 1접시)", aliases:["제육볶음 반찬"], unit:"count", baseQty:1, protein:15, carbs:10, sugar:5, fat:12, kcal:220 },
  { cat:"반찬·야채", key:"코다리조림", aliases:["코다리조림","코다리"], unit:"count", baseQty:1, protein:18, carbs:8, sugar:5, fat:6, kcal:170 },
  { cat:"반찬·야채", key:"상추", aliases:["상추","쌈상추"], unit:"count", baseQty:1, gramsPerServing:10, protein:0.1, carbs:0.3, sugar:0.1, fat:0, kcal:2 },
  { cat:"반찬·야채", key:"깻잎", aliases:["깻잎","깻잎쌈"], unit:"count", baseQty:1, gramsPerServing:2, protein:0.1, carbs:0.2, sugar:0, fat:0, kcal:1 },
  { cat:"반찬·야채", key:"양상추", aliases:["양상추","아이스버그"], unit:"gram", baseQty:100, protein:0.9, carbs:3, sugar:2, fat:0.1, kcal:14 },
  { cat:"반찬·야채", key:"오이(생)", aliases:["오이(생)","생오이","오이슬라이스"], unit:"gram", baseQty:100, protein:0.7, carbs:3.6, sugar:1.7, fat:0.1, kcal:15 },
  { cat:"반찬·야채", key:"숙주나물", aliases:["숙주","숙주나물"], unit:"count", baseQty:1, protein:2, carbs:4, sugar:1, fat:3, kcal:50, gramsPerServing:80 },
  { cat:"반찬·야채", key:"도토리묵", aliases:["도토리묵","묵무침"], unit:"count", baseQty:1, protein:2, carbs:10, sugar:1, fat:3, kcal:70, gramsPerServing:100 },
  { cat:"반찬·야채", key:"잡채", aliases:["잡채"], unit:"count", baseQty:1, protein:4, carbs:25, sugar:6, fat:7, kcal:180, gramsPerServing:120 },
  { cat:"반찬·야채", key:"오징어채볶음", aliases:["오징어채볶음"], unit:"count", baseQty:1, protein:11, carbs:13, sugar:8, fat:5, kcal:145, gramsPerServing:40 },
  { cat:"반찬·야채", key:"꽈리고추볶음", aliases:["꽈리고추","꽈리고추볶음"], unit:"count", baseQty:1, protein:2, carbs:6, sugar:2, fat:5, kcal:75, gramsPerServing:60 },
  { cat:"반찬·야채", key:"건새우볶음", aliases:["건새우","건새우볶음"], unit:"count", baseQty:1, protein:12, carbs:6, sugar:3, fat:5, kcal:115, gramsPerServing:30 },
  { cat:"반찬·야채", key:"북어채무침", aliases:["북어채","북어채무침"], unit:"count", baseQty:1, protein:14, carbs:8, sugar:4, fat:4, kcal:125, gramsPerServing:40 },
  { cat:"반찬·야채", key:"미역줄기볶음", aliases:["미역줄기","미역줄기볶음"], unit:"count", baseQty:1, protein:1.5, carbs:5, sugar:1, fat:4, kcal:60, gramsPerServing:60 },
  { cat:"반찬·야채", key:"총각김치", aliases:["총각김치","알타리김치","알타리"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:3, fat:0.3, kcal:30, gramsPerServing:60 },
  { cat:"반찬·야채", key:"겉절이", aliases:["겉절이","배추겉절이"], unit:"count", baseQty:1, protein:1, carbs:4, sugar:2, fat:1, kcal:30, gramsPerServing:60 },
  { cat:"반찬·야채", key:"오이소박이", aliases:["오이소박이"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:3, fat:0.5, kcal:30, gramsPerServing:60 },
  { cat:"반찬·야채", key:"부추무침", aliases:["부추무침","부추겉절이"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:2, fat:3, kcal:55, gramsPerServing:60 },
  { cat:"반찬·야채", key:"명란젓", aliases:["명란젓","명란"], unit:"count", baseQty:1, protein:6, carbs:1, sugar:0, fat:2, kcal:45, gramsPerServing:20 },
  { cat:"반찬·야채", key:"새우젓", aliases:["새우젓"], unit:"count", baseQty:1, protein:3, carbs:0.5, sugar:0, fat:0.3, kcal:15, gramsPerServing:15 },
  { cat:"반찬·야채", key:"두부부침", aliases:["두부부침","두부구이","부친두부"], unit:"count", baseQty:1, protein:11, carbs:5, sugar:1, fat:10, kcal:160, gramsPerServing:120 },
  { cat:"반찬·야채", key:"호박전", aliases:["호박전","애호박전"], unit:"count", baseQty:1, protein:3, carbs:12, sugar:3, fat:8, kcal:130, gramsPerServing:80 },
  { cat:"반찬·야채", key:"동그랑땡", aliases:["동그랑땡","완자전"], unit:"count", baseQty:1, protein:9, carbs:8, sugar:2, fat:11, kcal:165, gramsPerServing:70 },
  { cat:"반찬·야채", key:"고등어구이", aliases:["고등어구이"], unit:"count", baseQty:1, protein:22, carbs:0, sugar:0, fat:15, kcal:230, gramsPerServing:100 },
  { cat:"반찬·야채", key:"갈치구이", aliases:["갈치구이"], unit:"count", baseQty:1, protein:20, carbs:0, sugar:0, fat:9, kcal:165, gramsPerServing:100 },
  { cat:"반찬·야채", key:"조기구이", aliases:["조기구이","굴비"], unit:"count", baseQty:1, protein:20, carbs:0, sugar:0, fat:5, kcal:130, gramsPerServing:90 },
  { cat:"반찬·야채", key:"삼치구이", aliases:["삼치구이"], unit:"count", baseQty:1, protein:21, carbs:0, sugar:0, fat:12, kcal:195, gramsPerServing:100 },
  { cat:"반찬·야채", key:"취나물", aliases:["취나물"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:1, fat:3, kcal:55, gramsPerServing:60 },
  { cat:"반찬·야채", key:"냉이무침", aliases:["냉이","냉이무침"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:1, fat:3, kcal:55, gramsPerServing:60 },
  { cat:"반찬·야채", key:"달래무침", aliases:["달래","달래무침"], unit:"count", baseQty:1, protein:2, carbs:5, sugar:2, fat:3, kcal:55, gramsPerServing:50 },
  { cat:"반찬·야채", key:"더덕무침", aliases:["더덕","더덕무침"], unit:"count", baseQty:1, protein:2, carbs:12, sugar:5, fat:3, kcal:85, gramsPerServing:60 },
  { cat:"반찬·야채", key:"열무김치", aliases:["열무김치","열무"], unit:"count", baseQty:1, protein:1, carbs:4, sugar:2, fat:0.3, kcal:25, gramsPerServing:60 },
  { cat:"반찬·야채", key:"백김치", aliases:["백김치"], unit:"count", baseQty:1, protein:1, carbs:4, sugar:2, fat:0.2, kcal:22, gramsPerServing:60 },
  { cat:"반찬·야채", key:"콩자반", aliases:["콩자반","콩조림"], unit:"count", baseQty:1, protein:7, carbs:15, sugar:8, fat:4, kcal:125, gramsPerServing:50 },
  { cat:"반찬·야채", key:"소세지야채볶음", aliases:["소세지야채볶음","소시지야채볶음"], unit:"count", baseQty:1, protein:8, carbs:9, sugar:4, fat:12, kcal:175, gramsPerServing:90 },
  { cat:"반찬·야채", key:"스팸구이", aliases:["스팸구이"], unit:"count", baseQty:1, protein:7, carbs:1, sugar:0, fat:14, kcal:155, gramsPerServing:50 },
  { cat:"반찬·야채", key:"참치마요", aliases:["참치마요","참치마요네즈"], unit:"count", baseQty:1, protein:12, carbs:3, sugar:1, fat:14, kcal:185, gramsPerServing:70 },
  { cat:"반찬·야채", key:"계란장조림", aliases:["계란장조림","달걀장조림"], unit:"count", baseQty:1, protein:12, carbs:5, sugar:3, fat:9, kcal:150, gramsPerServing:100 },

  // ---- 면류 (1인분 기준) ----
  { cat:"면류", key:"물냉면", aliases:["물냉면"], unit:"count", baseQty:1, protein:14, carbs:85, sugar:14, fat:5, kcal:460 },
  { cat:"면류", key:"비빔냉면", aliases:["비빔냉면"], unit:"count", baseQty:1, protein:14, carbs:90, sugar:20, fat:6, kcal:500 },
  { cat:"면류", key:"콩국수", aliases:["콩국수"], unit:"count", baseQty:1, protein:22, carbs:80, sugar:8, fat:16, kcal:560 },
  { cat:"면류", key:"막국수", aliases:["막국수"], unit:"count", baseQty:1, protein:12, carbs:78, sugar:12, fat:6, kcal:440 },
  { cat:"면류", key:"짜장라면", aliases:["짜장라면","짜파게티"], unit:"count", baseQty:1, protein:11, carbs:82, sugar:8, fat:18, kcal:540 },
  { cat:"면류", key:"비빔면", aliases:["비빔면","팔도비빔면"], unit:"count", baseQty:1, protein:9, carbs:80, sugar:14, fat:14, kcal:520 },
  { cat:"면류", key:"쫄쫄이국수", aliases:["잔치쫄면"], unit:"count", baseQty:1, protein:10, carbs:82, sugar:12, fat:6, kcal:440 },
  { cat:"면류", key:"파스타 크림", aliases:["크림파스타","까르보나라"], unit:"count", baseQty:1, protein:20, carbs:75, sugar:8, fat:32, kcal:720 },
  { cat:"면류", key:"파스타 토마토", aliases:["토마토파스타","아라비아타"], unit:"count", baseQty:1, protein:16, carbs:82, sugar:12, fat:14, kcal:560 },
  { cat:"면류", key:"파스타 오일", aliases:["오일파스타","알리오올리오"], unit:"count", baseQty:1, protein:14, carbs:78, sugar:4, fat:20, kcal:580 },
  { cat:"면류", key:"라자냐", aliases:["라자냐"], unit:"count", baseQty:1, protein:24, carbs:55, sugar:10, fat:28, kcal:600 },
  { cat:"면류", key:"국수전골", aliases:["국수전골","멸치국수"], unit:"count", baseQty:1, protein:13, carbs:76, sugar:4, fat:6, kcal:420 },
  { cat:"면류", key:"마카로니", aliases:["마카로니","마카로니샐러드"], unit:"count", baseQty:1, protein:12, carbs:71, sugar:3, fat:1.5, kcal:350, gramsPerServing:100 },
  { cat:"면류", key:"펜네파스타", aliases:["펜네","펜네파스타"], unit:"count", baseQty:1, protein:17, carbs:75, sugar:6, fat:18, kcal:560, gramsPerServing:300 },
  { cat:"면류", key:"봉골레파스타", aliases:["봉골레","봉골레파스타"], unit:"count", baseQty:1, protein:20, carbs:68, sugar:4, fat:16, kcal:490, gramsPerServing:350 },
  { cat:"면류", key:"로제파스타", aliases:["로제파스타","로제"], unit:"count", baseQty:1, protein:20, carbs:72, sugar:8, fat:26, kcal:600, gramsPerServing:350 },
  { cat:"면류", key:"우동(면류)", aliases:["우동면"], unit:"count", baseQty:1, protein:12, carbs:78, sugar:3, fat:4, kcal:400, gramsPerServing:500 },
  { cat:"면류", key:"수제비(면류)", aliases:["수제비면"], unit:"count", baseQty:1, protein:12, carbs:68, sugar:3, fat:6, kcal:380, gramsPerServing:500 },
  { cat:"면류", key:"짬뽕라면", aliases:["짬뽕라면"], unit:"count", baseQty:1, protein:10, carbs:78, sugar:5, fat:16, kcal:500, gramsPerServing:550 },
  { cat:"면류", key:"볶음면", aliases:["볶음면","불닭볶음면"], unit:"count", baseQty:1, protein:10, carbs:80, sugar:6, fat:17, kcal:530, gramsPerServing:140 },
  { cat:"면류", key:"컵우동", aliases:["컵우동"], unit:"count", baseQty:1, protein:8, carbs:55, sugar:4, fat:12, kcal:350, gramsPerServing:250 },
  { cat:"면류", key:"스파게티 미트소스", aliases:["미트소스파스타","볼로네제"], unit:"count", baseQty:1, protein:22, carbs:74, sugar:10, fat:18, kcal:550, gramsPerServing:350 },

  // ---- 국·탕 (1인분 기준) ----
  { cat:"국·탕", key:"미역국", aliases:["미역국"], unit:"count", baseQty:1, protein:8, carbs:10, sugar:2, fat:6, kcal:130 },
  { cat:"국·탕", key:"북엇국", aliases:["북엇국","북어국"], unit:"count", baseQty:1, protein:14, carbs:8, sugar:1, fat:5, kcal:140 },
  { cat:"국·탕", key:"콩나물국", aliases:["콩나물국"], unit:"count", baseQty:1, protein:5, carbs:8, sugar:2, fat:2, kcal:70 },
  { cat:"국·탕", key:"순댓국", aliases:["순댓국","순대국밥"], unit:"count", baseQty:1, protein:28, carbs:50, sugar:3, fat:22, kcal:520, gramsPerServing:700 },
  { cat:"국·탕", key:"육개장", aliases:["육개장"], unit:"count", baseQty:1, protein:24, carbs:45, sugar:3, fat:18, kcal:450, gramsPerServing:600 },
  { cat:"국·탕", key:"추어탕", aliases:["추어탕"], unit:"count", baseQty:1, protein:26, carbs:40, sugar:3, fat:15, kcal:420, gramsPerServing:600 },
  { cat:"국·탕", key:"곰탕", aliases:["곰탕"], unit:"count", baseQty:1, protein:26, carbs:48, sugar:1, fat:12, kcal:410, gramsPerServing:600 },
  { cat:"국·탕", key:"떡만둣국", aliases:["떡만둣국","만둣국"], unit:"count", baseQty:1, protein:16, carbs:82, sugar:3, fat:12, kcal:520, gramsPerServing:700 },
  { cat:"국·탕", key:"김치콩나물국", aliases:["김치국","콩나물해장국"], unit:"count", baseQty:1, protein:6, carbs:10, sugar:2, fat:3, kcal:90 },
  { cat:"국·탕", key:"된장국", aliases:["된장국"], unit:"count", baseQty:1, protein:8, carbs:10, sugar:3, fat:5, kcal:110 },
  { cat:"국·탕", key:"미소된장국", aliases:["미소국","미소된장국"], unit:"count", baseQty:1, protein:5, carbs:6, sugar:2, fat:2, kcal:60 },
  { cat:"국·탕", key:"어묵탕", aliases:["어묵탕","오뎅탕"], unit:"count", baseQty:1, protein:14, carbs:20, sugar:4, fat:6, kcal:200 },
  { cat:"국·탕", key:"매운탕", aliases:["매운탕","생선매운탕"], unit:"count", baseQty:1, protein:28, carbs:15, sugar:3, fat:10, kcal:280 },
  { cat:"국·탕", key:"동태탕", aliases:["동태탕","동태찌개"], unit:"count", baseQty:1, protein:26, carbs:12, sugar:2, fat:6, kcal:220 },
  { cat:"국·탕", key:"닭곰탕", aliases:["닭곰탕","닭개장"], unit:"count", baseQty:1, protein:28, carbs:40, sugar:2, fat:12, kcal:400, gramsPerServing:600 },

  // ---- 고기·구이 (1인분 150g 기준) ----
  { cat:"고기·구이", key:"목살구이", aliases:["목살구이"], unit:"count", baseQty:1, protein:33, carbs:2, sugar:0, fat:30, kcal:410 },
  { cat:"고기·구이", key:"항정살", aliases:["항정살"], unit:"count", baseQty:1, protein:28, carbs:1, sugar:0, fat:38, kcal:460 },
  { cat:"고기·구이", key:"갈매기살", aliases:["갈매기살"], unit:"count", baseQty:1, protein:32, carbs:1, sugar:0, fat:22, kcal:340 },
  { cat:"고기·구이", key:"차돌박이", aliases:["차돌박이"], unit:"count", baseQty:1, protein:26, carbs:1, sugar:0, fat:42, kcal:490 },
  { cat:"고기·구이", key:"양념갈비", aliases:["양념갈비","돼지갈비"], unit:"count", baseQty:1, protein:28, carbs:20, sugar:14, fat:32, kcal:470 },
  { cat:"고기·구이", key:"소갈비살", aliases:["소갈비살","꽃갈비"], unit:"count", baseQty:1, protein:30, carbs:2, sugar:0, fat:35, kcal:460 },
  { cat:"고기·구이", key:"등심스테이크", aliases:["등심스테이크","스테이크"], unit:"count", baseQty:1, protein:38, carbs:3, sugar:0, fat:28, kcal:430 },
  { cat:"고기·구이", key:"안심스테이크", aliases:["안심스테이크"], unit:"count", baseQty:1, protein:40, carbs:2, sugar:0, fat:18, kcal:340 },
  { cat:"고기·구이", key:"닭갈비(구이 1인분)", aliases:["닭갈비 구이"], unit:"count", baseQty:1, protein:32, carbs:12, sugar:8, fat:16, kcal:340 },
  { cat:"고기·구이", key:"오리구이", aliases:["오리구이","훈제오리"], unit:"count", baseQty:1, protein:28, carbs:2, sugar:0, fat:30, kcal:400 },
  { cat:"고기·구이", key:"양고기", aliases:["양고기","램","양갈비"], unit:"count", baseQty:1, protein:30, carbs:1, sugar:0, fat:26, kcal:380 },
  { cat:"고기·구이", key:"닭볶음탕", aliases:["닭볶음탕","닭도리탕"], unit:"count", baseQty:1, protein:35, carbs:30, sugar:12, fat:22, kcal:480 },
  { cat:"고기·구이", key:"안동찜닭", aliases:["안동찜닭"], unit:"count", baseQty:1, protein:34, carbs:55, sugar:20, fat:16, kcal:520 },
  { cat:"고기·구이", key:"닭한마리", aliases:["닭한마리"], unit:"count", baseQty:1, protein:40, carbs:35, sugar:4, fat:18, kcal:480 },
  { cat:"고기·구이", key:"닭발", aliases:["닭발"], unit:"count", baseQty:1, protein:20, carbs:15, sugar:8, fat:14, kcal:280 },
  { cat:"고기·구이", key:"불닭", aliases:["불닭","숯불닭갈비"], unit:"count", baseQty:1, protein:30, carbs:18, sugar:10, fat:18, kcal:360 },

  // ---- 과일 (1회분 기준) ----
  { cat:"과일", key:"딸기", aliases:["딸기"], unit:"count", baseQty:1, protein:1, carbs:12, sugar:8, fat:0.3, kcal:50, gramsPerServing:150 },
  { cat:"과일", key:"포도", aliases:["포도"], unit:"count", baseQty:1, protein:1, carbs:27, sugar:23, fat:0.2, kcal:104, gramsPerServing:100 },
  { cat:"과일", key:"블루베리", aliases:["블루베리"], unit:"count", baseQty:1, protein:1, carbs:21, sugar:15, fat:0.5, kcal:84, gramsPerServing:100 },
  { cat:"과일", key:"오렌지", aliases:["오렌지"], unit:"count", baseQty:1, protein:1, carbs:15, sugar:12, fat:0.2, kcal:62, gramsPerServing:200 },
  { cat:"과일", key:"귤", aliases:["귤"], unit:"count", baseQty:1, protein:0.5, carbs:9, sugar:7, fat:0.1, kcal:37, gramsPerServing:80 },
  { cat:"과일", key:"참외", aliases:["참외"], unit:"count", baseQty:1, protein:1, carbs:20, sugar:16, fat:0.2, kcal:80, gramsPerServing:200 },
  { cat:"과일", key:"수박", aliases:["수박"], unit:"count", baseQty:1, protein:1, carbs:22, sugar:18, fat:0.3, kcal:86, gramsPerServing:300 },
  { cat:"과일", key:"키위", aliases:["키위"], unit:"count", baseQty:1, protein:1, carbs:11, sugar:7, fat:0.4, kcal:46, gramsPerServing:80 },
  { cat:"과일", key:"배", aliases:["배(과일)"], unit:"count", baseQty:1, protein:0.6, carbs:27, sugar:17, fat:0.2, kcal:100, gramsPerServing:300 },
  { cat:"과일", key:"복숭아", aliases:["복숭아"], unit:"count", baseQty:1, protein:1, carbs:15, sugar:13, fat:0.3, kcal:60, gramsPerServing:200 },
  { cat:"과일", key:"망고", aliases:["망고"], unit:"count", baseQty:1, protein:1.4, carbs:25, sugar:23, fat:0.6, kcal:100, gramsPerServing:200 },
  { cat:"과일", key:"파인애플", aliases:["파인애플"], unit:"count", baseQty:1, protein:0.5, carbs:13, sugar:10, fat:0.1, kcal:50, gramsPerServing:150 },
  { cat:"과일", key:"체리", aliases:["체리"], unit:"count", baseQty:1, protein:1, carbs:16, sugar:13, fat:0.2, kcal:63, gramsPerServing:100 },
  { cat:"과일", key:"자두", aliases:["자두"], unit:"count", baseQty:1, protein:0.5, carbs:8, sugar:7, fat:0.2, kcal:30, gramsPerServing:70 },
  { cat:"과일", key:"감", aliases:["감","단감"], unit:"count", baseQty:1, protein:1, carbs:31, sugar:21, fat:0.3, kcal:118, gramsPerServing:150 },
  { cat:"과일", key:"멜론", aliases:["멜론"], unit:"count", baseQty:1, protein:1, carbs:14, sugar:13, fat:0.2, kcal:56, gramsPerServing:200 },
  { cat:"과일", key:"레몬", aliases:["레몬"], unit:"count", baseQty:1, protein:0.6, carbs:5, sugar:1.5, fat:0.2, kcal:17, gramsPerServing:60 },
  { cat:"과일", key:"석류", aliases:["석류"], unit:"count", baseQty:1, protein:1.7, carbs:19, sugar:14, fat:1.2, kcal:83, gramsPerServing:150 },
  { cat:"과일", key:"자몽", aliases:["자몽"], unit:"count", baseQty:1, protein:1, carbs:13, sugar:11, fat:0.2, kcal:52, gramsPerServing:230 },

  // ---- 술·안주 ----
  { cat:"술·안주", key:"맥주", aliases:["맥주"], unit:"count", baseQty:1, protein:1.6, carbs:13, sugar:0, fat:0, kcal:150 },
  { cat:"술·안주", key:"소주", aliases:["소주"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:70 },
  { cat:"술·안주", key:"막걸리", aliases:["막걸리"], unit:"count", baseQty:1, protein:1.5, carbs:8, sugar:3, fat:0, kcal:100 },
  { cat:"술·안주", key:"와인", aliases:["와인"], unit:"count", baseQty:1, protein:0.1, carbs:4, sugar:1, fat:0, kcal:125 },
  { cat:"술·안주", key:"하이볼", aliases:["하이볼"], unit:"count", baseQty:1, protein:0, carbs:8, sugar:6, fat:0, kcal:120 },
  { cat:"술·안주", key:"위스키", aliases:["위스키"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:97 },
  { cat:"술·안주", key:"골뱅이무침", aliases:["골뱅이무침","골뱅이"], unit:"count", baseQty:1, protein:20, carbs:25, sugar:10, fat:6, kcal:250 },
  { cat:"술·안주", key:"노가리", aliases:["노가리"], unit:"count", baseQty:1, protein:18, carbs:2, sugar:0, fat:2, kcal:100 },
  { cat:"술·안주", key:"마른오징어", aliases:["마른오징어","오징어채안주"], unit:"count", baseQty:1, protein:20, carbs:3, sugar:0, fat:2, kcal:110 },
  { cat:"술·안주", key:"먹태", aliases:["먹태","황태채"], unit:"count", baseQty:1, protein:22, carbs:2, sugar:0, fat:1, kcal:110 },
  { cat:"술·안주", key:"나초", aliases:["나초"], unit:"count", baseQty:1, protein:8, carbs:45, sugar:3, fat:24, kcal:420 },
  { cat:"술·안주", key:"치즈스틱", aliases:["치즈스틱","모짜렐라스틱"], unit:"count", baseQty:1, protein:6, carbs:15, sugar:1, fat:10, kcal:180 },
  { cat:"술·안주", key:"닭똥집", aliases:["닭똥집","똥집"], unit:"count", baseQty:1, protein:24, carbs:8, sugar:1, fat:14, kcal:250 },
  { cat:"술·안주", key:"오돌뼈", aliases:["오돌뼈"], unit:"count", baseQty:1, protein:22, carbs:15, sugar:10, fat:20, kcal:340 },
  { cat:"술·안주", key:"생맥주", aliases:["생맥주","생맥"], unit:"count", baseQty:1, protein:1.6, carbs:13, sugar:0, fat:0, kcal:210, gramsPerServing:500 },
  { cat:"술·안주", key:"청하", aliases:["청하"], unit:"count", baseQty:1, protein:0, carbs:8, sugar:8, fat:0, kcal:200, gramsPerServing:300 },
  { cat:"술·안주", key:"사케", aliases:["사케","정종"], unit:"count", baseQty:1, protein:0.5, carbs:9, sugar:3, fat:0, kcal:200, gramsPerServing:180 },
  { cat:"술·안주", key:"고량주", aliases:["고량주","빼갈"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:230, gramsPerServing:100 },
  { cat:"술·안주", key:"칵테일", aliases:["칵테일","모히토"], unit:"count", baseQty:1, protein:0, carbs:20, sugar:18, fat:0, kcal:200, gramsPerServing:250 },
  { cat:"술·안주", key:"과일소주", aliases:["과일소주","순하리"], unit:"count", baseQty:1, protein:0, carbs:20, sugar:18, fat:0, kcal:250, gramsPerServing:360 },
  { cat:"술·안주", key:"논알콜맥주", aliases:["논알콜맥주","무알콜맥주"], unit:"count", baseQty:1, protein:0.8, carbs:12, sugar:6, fat:0, kcal:60, gramsPerServing:350 },
  { cat:"술·안주", key:"쥐포", aliases:["쥐포"], unit:"count", baseQty:1, protein:15, carbs:12, sugar:6, fat:1.5, kcal:125, gramsPerServing:35 },
  { cat:"술·안주", key:"먹태땅콩", aliases:["먹태땅콩","땅콩"], unit:"count", baseQty:1, protein:8, carbs:6, sugar:2, fat:14, kcal:175, gramsPerServing:30 },
  { cat:"술·안주", key:"소시지야채", aliases:["소시지야채","소세지구이"], unit:"count", baseQty:1, protein:12, carbs:10, sugar:5, fat:20, kcal:270, gramsPerServing:150 },
  { cat:"술·안주", key:"계란말이(안주)", aliases:["계란말이 안주"], unit:"count", baseQty:1, protein:16, carbs:4, sugar:2, fat:16, kcal:225, gramsPerServing:200 },
  { cat:"술·안주", key:"두부김치", aliases:["두부김치"], unit:"count", baseQty:1, protein:16, carbs:12, sugar:5, fat:14, kcal:240, gramsPerServing:250 },
  { cat:"술·안주", key:"파전", aliases:["파전","해물파전"], unit:"count", baseQty:1, protein:12, carbs:40, sugar:4, fat:18, kcal:370, gramsPerServing:250 },
  { cat:"술·안주", key:"김치전", aliases:["김치전"], unit:"count", baseQty:1, protein:8, carbs:38, sugar:5, fat:16, kcal:330, gramsPerServing:220 },
  { cat:"술·안주", key:"감자전", aliases:["감자전"], unit:"count", baseQty:1, protein:5, carbs:40, sugar:2, fat:14, kcal:300, gramsPerServing:220 },
  { cat:"술·안주", key:"육회", aliases:["육회"], unit:"count", baseQty:1, protein:22, carbs:6, sugar:3, fat:8, kcal:180, gramsPerServing:150 },
  { cat:"술·안주", key:"연어샐러드(안주)", aliases:["연어샐러드 안주"], unit:"count", baseQty:1, protein:20, carbs:8, sugar:4, fat:14, kcal:240, gramsPerServing:200 },
  { cat:"술·안주", key:"어묵탕(안주)", aliases:["어묵탕 안주"], unit:"count", baseQty:1, protein:12, carbs:18, sugar:6, fat:8, kcal:190, gramsPerServing:400 },
  { cat:"술·안주", key:"番데기", aliases:["번데기"], unit:"count", baseQty:1, protein:12, carbs:4, sugar:0, fat:5, kcal:105, gramsPerServing:80 },
  { cat:"술·안주", key:"계란찜(안주)", aliases:["계란찜 안주"], unit:"count", baseQty:1, protein:14, carbs:4, sugar:2, fat:10, kcal:165, gramsPerServing:250 },
  { cat:"술·안주", key:"치킨무", aliases:["치킨무"], unit:"count", baseQty:1, protein:0.3, carbs:4, sugar:3, fat:0, kcal:18, gramsPerServing:60 },

  // ---- 디저트 (1개/1조각 기준) ----
  { cat:"디저트", key:"조각케이크", aliases:["케이크","조각케이크"], unit:"count", baseQty:1, protein:5, carbs:45, sugar:32, fat:18, kcal:360 },
  { cat:"디저트", key:"티라미수", aliases:["티라미수"], unit:"count", baseQty:1, protein:6, carbs:40, sugar:28, fat:22, kcal:400 },
  { cat:"디저트", key:"치즈케이크", aliases:["치즈케이크"], unit:"count", baseQty:1, protein:7, carbs:35, sugar:26, fat:24, kcal:400 },
  { cat:"디저트", key:"도넛", aliases:["도넛"], unit:"count", baseQty:1, protein:4, carbs:35, sugar:18, fat:16, kcal:300 },
  { cat:"디저트", key:"와플", aliases:["와플"], unit:"count", baseQty:1, protein:7, carbs:45, sugar:18, fat:16, kcal:370 },
  { cat:"디저트", key:"츄러스", aliases:["츄러스"], unit:"count", baseQty:1, protein:3, carbs:30, sugar:12, fat:14, kcal:260 },
  { cat:"디저트", key:"빙수", aliases:["빙수","팥빙수"], unit:"count", baseQty:1, protein:8, carbs:90, sugar:60, fat:12, kcal:500 },
  { cat:"디저트", key:"젤라또", aliases:["젤라또","아이스크림컵"], unit:"count", baseQty:1, protein:4, carbs:30, sugar:26, fat:10, kcal:230 },
  { cat:"디저트", key:"에그타르트", aliases:["에그타르트"], unit:"count", baseQty:1, protein:4, carbs:24, sugar:12, fat:12, kcal:220 },
  { cat:"디저트", key:"푸딩", aliases:["푸딩"], unit:"count", baseQty:1, protein:4, carbs:25, sugar:22, fat:6, kcal:170 },
  { cat:"디저트", key:"떡", aliases:["떡","백설기","시루떡"], unit:"count", baseQty:1, protein:3, carbs:45, sugar:12, fat:1, kcal:200 },
  { cat:"디저트", key:"꿀떡", aliases:["꿀떡"], unit:"count", baseQty:1, protein:2, carbs:40, sugar:18, fat:2, kcal:190 },
  { cat:"디저트", key:"인절미", aliases:["인절미"], unit:"count", baseQty:1, protein:4, carbs:42, sugar:10, fat:4, kcal:220 },
  { cat:"디저트", key:"마들렌", aliases:["마들렌"], unit:"count", baseQty:1, protein:3, carbs:25, sugar:14, fat:10, kcal:210, gramsPerServing:50 },
  { cat:"디저트", key:"휘낭시에", aliases:["휘낭시에"], unit:"count", baseQty:1, protein:3, carbs:22, sugar:13, fat:12, kcal:210, gramsPerServing:45 },
  { cat:"디저트", key:"스콘", aliases:["스콘"], unit:"count", baseQty:1, protein:6, carbs:40, sugar:10, fat:14, kcal:320, gramsPerServing:80 },
  { cat:"디저트", key:"브라우니", aliases:["브라우니"], unit:"count", baseQty:1, protein:5, carbs:40, sugar:28, fat:16, kcal:320, gramsPerServing:70 },
  { cat:"디저트", key:"쿠키", aliases:["쿠키","초코쿠키"], unit:"count", baseQty:1, protein:3, carbs:30, sugar:16, fat:11, kcal:230, gramsPerServing:50 },
  { cat:"디저트", key:" 크림빵(디저트)", aliases:["생크림빵"], unit:"count", baseQty:1, protein:6, carbs:45, sugar:20, fat:16, kcal:360, gramsPerServing:100 },
  { cat:"디저트", key:"호두과자", aliases:["호두과자"], unit:"count", baseQty:1, protein:4, carbs:30, sugar:14, fat:8, kcal:210, gramsPerServing:70 },
  { cat:"디저트", key:"붕어빵(디저트)", aliases:["붕어빵 디저트"], unit:"count", baseQty:1, protein:4, carbs:32, sugar:12, fat:5, kcal:190, gramsPerServing:70 },
  { cat:"디저트", key:"찹쌀떡", aliases:["찹쌀떡","모찌"], unit:"count", baseQty:1, protein:3, carbs:44, sugar:18, fat:1, kcal:200, gramsPerServing:90 },
  { cat:"디저트", key:"약식", aliases:["약식"], unit:"count", baseQty:1, protein:4, carbs:55, sugar:20, fat:5, kcal:280, gramsPerServing:120 },
  { cat:"디저트", key:"과일타르트", aliases:["과일타르트","타르트"], unit:"count", baseQty:1, protein:4, carbs:42, sugar:24, fat:14, kcal:310, gramsPerServing:110 },

  // ---- 아침식사 (기본재료로 분류, 1인분 기준) ----
  { cat:"기본재료", key:"스크램블에그", aliases:["스크램블에그","스크램블"], unit:"count", baseQty:1, protein:13, carbs:2, sugar:1, fat:15, kcal:200 },
  { cat:"기본재료", key:"아보카도토스트", aliases:["아보카도토스트"], unit:"count", baseQty:1, protein:10, carbs:30, sugar:4, fat:20, kcal:340 },
  { cat:"기본재료", key:"프렌치토스트", aliases:["프렌치토스트"], unit:"count", baseQty:1, protein:10, carbs:40, sugar:14, fat:14, kcal:330 },
  { cat:"기본재료", key:"팬케이크", aliases:["팬케이크","핫케이크"], unit:"count", baseQty:1, protein:8, carbs:55, sugar:20, fat:12, kcal:370 },
  { cat:"기본재료", key:"요거트볼", aliases:["요거트볼","그릭요거트볼"], unit:"count", baseQty:1, protein:18, carbs:35, sugar:20, fat:8, kcal:290 },
  { cat:"기본재료", key:"베이컨", aliases:["베이컨"], unit:"count", baseQty:1, protein:12, carbs:1, sugar:0, fat:14, kcal:170 },
  { cat:"기본재료", key:"소시지", aliases:["소시지","비엔나"], unit:"count", baseQty:1, protein:6, carbs:2, sugar:1, fat:9, kcal:110 },
  { cat:"기본재료", key:"햄", aliases:["햄","스팸"], unit:"count", baseQty:1, protein:7, carbs:2, sugar:1, fat:8, kcal:110 },
  { cat:"기본재료", key:"치즈오믈렛", aliases:["오믈렛","치즈오믈렛"], unit:"count", baseQty:1, protein:18, carbs:4, sugar:2, fat:20, kcal:270 },
  { cat:"기본재료", key:"곡물바", aliases:["곡물바","그래놀라바"], unit:"count", baseQty:1, protein:5, carbs:28, sugar:14, fat:7, kcal:190 },

  // ---- 추가 대표 메뉴 ----
  // 밥류
  { cat:"기본재료", key:"잡곡밥", aliases:["잡곡밥","오곡밥","혼합잡곡밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:7, carbs:63, sugar:1, fat:2, kcal:300 },
  { cat:"기본재료", key:"보리밥", aliases:["보리밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:6, carbs:62, sugar:1, fat:1.5, kcal:290 },
  { cat:"기본재료", key:"콩밥", aliases:["콩밥","서리태밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:9, carbs:60, sugar:1, fat:2.5, kcal:305 },
  { cat:"기본재료", key:"귀리밥", aliases:["귀리밥","오트밥"], unit:"count", baseQty:1, gramsPerUnit:210, protein:8, carbs:60, sugar:1, fat:3, kcal:300 },
  // 곱창·해물 볶음류
  { cat:"고기·구이", key:"낙곱새", aliases:["낙곱새","낙지곱창새우"], unit:"count", baseQty:1, protein:32, carbs:25, sugar:10, fat:24, kcal:480 },
  { cat:"고기·구이", key:"낙대창새우", aliases:["낙대창새우","낙지대창새우"], unit:"count", baseQty:1, protein:30, carbs:22, sugar:9, fat:34, kcal:560 },
  { cat:"고기·구이", key:"낙지볶음", aliases:["낙지볶음"], unit:"count", baseQty:1, protein:24, carbs:28, sugar:10, fat:12, kcal:340 },
  { cat:"고기·구이", key:"쭈꾸미볶음", aliases:["쭈꾸미볶음","주꾸미볶음","쭈꾸미"], unit:"count", baseQty:1, protein:26, carbs:26, sugar:11, fat:12, kcal:340 },
  { cat:"고기·구이", key:"대창구이", aliases:["대창","대창구이"], unit:"count", baseQty:1, protein:14, carbs:2, sugar:0, fat:48, kcal:520 },
  { cat:"고기·구이", key:"막창구이", aliases:["막창구이","막창"], unit:"count", baseQty:1, protein:16, carbs:2, sugar:0, fat:42, kcal:470 },
  { cat:"고기·구이", key:"곱창볶음", aliases:["곱창볶음"], unit:"count", baseQty:1, protein:22, carbs:18, sugar:8, fat:32, kcal:450 },
  { cat:"고기·구이", key:"소곱창구이", aliases:["소곱창","곱창구이"], unit:"count", baseQty:1, protein:20, carbs:4, sugar:1, fat:38, kcal:440 },
  { cat:"고기·구이", key:"양꼬치", aliases:["양꼬치"], unit:"count", baseQty:1, protein:9, carbs:2, sugar:0, fat:8, kcal:110 },
  { cat:"고기·구이", key:"닭꼬치", aliases:["닭꼬치"], unit:"count", baseQty:1, protein:12, carbs:8, sugar:6, fat:6, kcal:140 },
  { cat:"고기·구이", key:"삼겹살김치볶음", aliases:["삼겹살김치볶음","두루치기"], unit:"count", baseQty:1, protein:24, carbs:12, sugar:6, fat:34, kcal:450 },
  // 해산물
  { cat:"고기·구이", key:"오징어볶음", aliases:["오징어볶음"], unit:"count", baseQty:1, protein:24, carbs:24, sugar:12, fat:12, kcal:330 },
  { cat:"고기·구이", key:"주꾸미삼겹", aliases:["주꾸미삼겹","쭈삼"], unit:"count", baseQty:1, protein:28, carbs:20, sugar:9, fat:28, kcal:470 },
  { cat:"국·탕", key:"해물탕", aliases:["해물탕"], unit:"count", baseQty:1, protein:30, carbs:15, sugar:4, fat:8, kcal:280 },
  { cat:"국·탕", key:"알탕", aliases:["알탕"], unit:"count", baseQty:1, protein:28, carbs:12, sugar:3, fat:10, kcal:270 },
  { cat:"국·탕", key:"짬뽕순두부", aliases:["짬뽕순두부"], unit:"count", baseQty:1, protein:22, carbs:20, sugar:5, fat:16, kcal:340 },
  // 인기 외식/한식
  { cat:"한식", key:"제육쌈밥", aliases:["제육쌈밥","쌈밥"], unit:"count", baseQty:1, protein:30, carbs:95, sugar:10, fat:24, kcal:700 },
  { cat:"한식", key:"보쌈정식", aliases:["보쌈정식"], unit:"count", baseQty:1, protein:38, carbs:40, sugar:6, fat:34, kcal:640 },
  { cat:"한식", key:"콩나물국밥", aliases:["콩나물국밥"], unit:"count", baseQty:1, protein:14, carbs:60, sugar:3, fat:8, kcal:380 },
  { cat:"한식", key:"육회비빔밥", aliases:["육회비빔밥"], unit:"count", baseQty:1, protein:24, carbs:88, sugar:8, fat:14, kcal:580 },
  { cat:"한식", key:"산낙지", aliases:["산낙지"], unit:"count", baseQty:1, protein:16, carbs:4, sugar:0, fat:1.5, kcal:90 },
  { cat:"한식", key:"골뱅이소면", aliases:["골뱅이소면"], unit:"count", baseQty:1, protein:22, carbs:70, sugar:14, fat:8, kcal:470 },

  // ---- 고기 부위별 (100g 생고기/구이 전 기준) ----
  // 돼지고기
  { cat:"고기·구이", key:"항정살(생고기 기준)", aliases:["항정"], unit:"gram", baseQty:100, protein:19, carbs:0, sugar:0, fat:25, kcal:300 },
  { cat:"고기·구이", key:"갈매기살(생고기 기준)", aliases:["갈매기"], unit:"gram", baseQty:100, protein:21, carbs:0, sugar:0, fat:14, kcal:210 },
  { cat:"고기·구이", key:"돼지앞다리살", aliases:["앞다리살","전지"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:12, kcal:190 },
  { cat:"고기·구이", key:"돼지뒷다리살", aliases:["뒷다리살","후지"], unit:"gram", baseQty:100, protein:21, carbs:0, sugar:0, fat:7, kcal:150 },
  { cat:"고기·구이", key:"돼지등심", aliases:["돼지등심"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:6, kcal:145 },
  { cat:"고기·구이", key:"돼지안심(부위)", aliases:["돼지안심살"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:4, kcal:125 },
  { cat:"고기·구이", key:"오겹살", aliases:["오겹살"], unit:"gram", baseQty:100, protein:16, carbs:0, sugar:0, fat:36, kcal:395 },
  { cat:"고기·구이", key:"돼지갈비(생)", aliases:["돼지갈비살","포크립"], unit:"gram", baseQty:100, protein:18, carbs:0, sugar:0, fat:25, kcal:300 },
  // 소고기
  { cat:"고기·구이", key:"소안심(생)", aliases:["소안심","안심"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:10, kcal:180 },
  { cat:"고기·구이", key:"채끝(생)", aliases:["채끝","채끝등심"], unit:"gram", baseQty:100, protein:21, carbs:0, sugar:0, fat:14, kcal:215 },
  { cat:"고기·구이", key:"차돌박이(생고기 기준)", aliases:["차돌"], unit:"gram", baseQty:100, protein:18, carbs:0, sugar:0, fat:30, kcal:340 },
  { cat:"고기·구이", key:"부챗살", aliases:["부챗살","부채살"], unit:"gram", baseQty:100, protein:21, carbs:0, sugar:0, fat:12, kcal:195 },
  { cat:"고기·구이", key:"살치살", aliases:["살치살"], unit:"gram", baseQty:100, protein:18, carbs:0, sugar:0, fat:28, kcal:325 },
  { cat:"고기·구이", key:"토시살", aliases:["토시살"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:16, kcal:230 },
  { cat:"고기·구이", key:"우삼겹", aliases:["우삼겹"], unit:"gram", baseQty:100, protein:17, carbs:0, sugar:0, fat:32, kcal:355 },
  { cat:"고기·구이", key:"소갈비살(생고기 기준)", aliases:["갈비살","꽃갈비살"], unit:"gram", baseQty:100, protein:19, carbs:0, sugar:0, fat:22, kcal:280 },
  { cat:"고기·구이", key:"양지(생)", aliases:["양지","양지머리"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:15, kcal:220 },
  { cat:"고기·구이", key:"사태", aliases:["사태"], unit:"gram", baseQty:100, protein:21, carbs:0, sugar:0, fat:6, kcal:140 },
  { cat:"고기·구이", key:"우둔살", aliases:["우둔","홍두깨살"], unit:"gram", baseQty:100, protein:22, carbs:0, sugar:0, fat:4, kcal:125 },
  // 닭·기타
  { cat:"고기·구이", key:"닭날개", aliases:["닭날개","윙"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:13, kcal:200 },
  { cat:"고기·구이", key:"오리고기(생)", aliases:["오리고기","오리살"], unit:"gram", baseQty:100, protein:19, carbs:0, sugar:0, fat:28, kcal:335 },
  { cat:"고기·구이", key:"양고기(생고기 기준)", aliases:["양고기살","램구이"], unit:"gram", baseQty:100, protein:20, carbs:0, sugar:0, fat:21, kcal:280 },
  { cat:"고기·구이", key:"양갈비(생)", aliases:["양갈비살","램찹"], unit:"gram", baseQty:100, protein:18, carbs:0, sugar:0, fat:25, kcal:300 },
  // 꼬치류 (1꼬치 기준)
  { cat:"고기·구이", key:"소고기꼬치", aliases:["소고기꼬치"], unit:"count", baseQty:1, protein:10, carbs:2, sugar:1, fat:6, kcal:100 },
  { cat:"고기·구이", key:"떡꼬치", aliases:["떡꼬치"], unit:"count", baseQty:1, protein:3, carbs:35, sugar:10, fat:5, kcal:200 },
  { cat:"고기·구이", key:"소시지꼬치", aliases:["소시지꼬치","프랑크꼬치"], unit:"count", baseQty:1, protein:8, carbs:12, sugar:4, fat:14, kcal:210 },

  // ---- 소스·양념 (1큰술 ≈ 동전크기 15g 기준) ----
  // 기본 양념
  { cat:"소스·양념", key:"소금", aliases:["소금"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:0, kcal:0 },
  { cat:"소스·양념", key:"후추", aliases:["후추"], unit:"count", baseQty:1, protein:0, carbs:1, sugar:0, fat:0, kcal:5 },
  { cat:"소스·양념", key:"설탕", aliases:["설탕"], unit:"count", baseQty:1, protein:0, carbs:12, sugar:12, fat:0, kcal:48 },
  { cat:"소스·양념", key:"참기름", aliases:["참기름"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:14, kcal:120 },
  { cat:"소스·양념", key:"들기름", aliases:["들기름"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:14, kcal:120 },
  { cat:"소스·양념", key:"올리브유", aliases:["올리브유","올리브오일"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:14, kcal:120 },
  { cat:"소스·양념", key:"식용유", aliases:["식용유","카놀라유"], unit:"count", baseQty:1, protein:0, carbs:0, sugar:0, fat:14, kcal:120 },
  { cat:"소스·양념", key:"버터", aliases:["버터"], unit:"count", baseQty:1, protein:0.1, carbs:0, sugar:0, fat:11, kcal:100 },
  { cat:"소스·양념", key:"마요네즈", aliases:["마요네즈","마요"], unit:"count", baseQty:1, protein:0.2, carbs:1, sugar:1, fat:11, kcal:100 },
  // 일반 소스
  { cat:"소스·양념", key:"케찹", aliases:["케찹","케첩","토마토케찹"], unit:"count", baseQty:1, protein:0.2, carbs:5, sugar:4, fat:0, kcal:20 },
  { cat:"소스·양념", key:"머스타드", aliases:["머스타드","머스터드"], unit:"count", baseQty:1, protein:0.5, carbs:1, sugar:1, fat:0.5, kcal:12 },
  { cat:"소스·양념", key:"허니머스타드", aliases:["허니머스타드"], unit:"count", baseQty:1, protein:0.3, carbs:6, sugar:5, fat:2, kcal:45 },
  { cat:"소스·양념", key:"칠리소스", aliases:["칠리소스","스위트칠리"], unit:"count", baseQty:1, protein:0.2, carbs:8, sugar:7, fat:0, kcal:35 },
  { cat:"소스·양념", key:"굴소스", aliases:["굴소스"], unit:"count", baseQty:1, protein:1, carbs:5, sugar:3, fat:0, kcal:25 },
  { cat:"소스·양념", key:"간장", aliases:["간장"], unit:"count", baseQty:1, protein:1.3, carbs:1.5, sugar:0.5, fat:0, kcal:11 },
  { cat:"소스·양념", key:"진간장", aliases:["진간장"], unit:"count", baseQty:1, protein:1.3, carbs:2, sugar:1, fat:0, kcal:14 },
  { cat:"소스·양념", key:"된장", aliases:["된장"], unit:"count", baseQty:1, protein:2, carbs:3, sugar:1, fat:1, kcal:30 },
  { cat:"소스·양념", key:"고추장", aliases:["고추장"], unit:"count", baseQty:1, protein:1, carbs:9, sugar:5, fat:0.5, kcal:45 },
  { cat:"소스·양념", key:"쌈장", aliases:["쌈장"], unit:"count", baseQty:1, protein:1.5, carbs:5, sugar:2, fat:1, kcal:38 },
  { cat:"소스·양념", key:"초고추장", aliases:["초고추장"], unit:"count", baseQty:1, protein:0.8, carbs:10, sugar:7, fat:0.3, kcal:48 },
  { cat:"소스·양념", key:"스테이크소스", aliases:["스테이크소스","A1소스"], unit:"count", baseQty:1, protein:0.3, carbs:4, sugar:3, fat:0, kcal:18 },
  { cat:"소스·양념", key:"바베큐소스", aliases:["바베큐소스","BBQ소스"], unit:"count", baseQty:1, protein:0.2, carbs:7, sugar:6, fat:0, kcal:30 },
  { cat:"소스·양념", key:"돈까스소스", aliases:["돈까스소스","돈가스소스"], unit:"count", baseQty:1, protein:0.3, carbs:6, sugar:4, fat:0, kcal:28 },
  { cat:"소스·양념", key:"타르타르소스", aliases:["타르타르소스","타르타르"], unit:"count", baseQty:1, protein:0.3, carbs:2, sugar:1, fat:8, kcal:75 },
  { cat:"소스·양념", key:"치킨소스", aliases:["치킨소스","양념치킨소스"], unit:"count", baseQty:1, protein:0.5, carbs:9, sugar:7, fat:1, kcal:48 },
  { cat:"소스·양념", key:"칠리마요", aliases:["칠리마요"], unit:"count", baseQty:1, protein:0.3, carbs:4, sugar:3, fat:9, kcal:95 },
  { cat:"소스·양념", key:"스리라차", aliases:["스리라차","시라차"], unit:"count", baseQty:1, protein:0.2, carbs:2, sugar:2, fat:0, kcal:10 },
  { cat:"소스·양념", key:"핫소스", aliases:["핫소스","타바스코"], unit:"count", baseQty:1, protein:0.1, carbs:0.5, sugar:0, fat:0, kcal:3 },
  { cat:"소스·양념", key:"파스타소스", aliases:["파스타소스","토마토소스"], unit:"count", baseQty:1, protein:0.5, carbs:4, sugar:3, fat:1, kcal:25 },
  { cat:"소스·양념", key:"발사믹", aliases:["발사믹","발사믹식초"], unit:"count", baseQty:1, protein:0.1, carbs:3, sugar:2, fat:0, kcal:14 },
  { cat:"소스·양념", key:"오리엔탈드레싱", aliases:["오리엔탈드레싱"], unit:"count", baseQty:1, protein:0.2, carbs:3, sugar:2, fat:4, kcal:50 },
  { cat:"소스·양념", key:"시저드레싱", aliases:["시저드레싱"], unit:"count", baseQty:1, protein:0.5, carbs:1, sugar:1, fat:8, kcal:75 },
  { cat:"소스·양념", key:"랜치드레싱", aliases:["랜치드레싱","랜치소스"], unit:"count", baseQty:1, protein:0.3, carbs:1, sugar:1, fat:9, kcal:80 },
  // 저칼로리 (비비드 등 제로/라이트 계열)
  { cat:"소스·양념", key:"저칼로리 케찹", aliases:["저칼로리 케찹","제로케찹","비비드케찹"], unit:"count", baseQty:1, protein:0.1, carbs:1, sugar:0, fat:0, kcal:5 },
  { cat:"소스·양념", key:"저칼로리 머스타드", aliases:["저칼로리 머스타드","제로머스타드"], unit:"count", baseQty:1, protein:0.3, carbs:0.5, sugar:0, fat:0, kcal:5 },
  { cat:"소스·양념", key:"저칼로리 칠리소스", aliases:["저칼로리 칠리소스","제로칠리소스"], unit:"count", baseQty:1, protein:0.1, carbs:1.5, sugar:0, fat:0, kcal:7 },
  { cat:"소스·양념", key:"저칼로리 굴소스", aliases:["저칼로리 굴소스","제로굴소스"], unit:"count", baseQty:1, protein:0.8, carbs:2, sugar:0, fat:0, kcal:10 },
  { cat:"소스·양념", key:"저칼로리 마요", aliases:["저칼로리 마요","제로마요","라이트마요"], unit:"count", baseQty:1, protein:0.2, carbs:1, sugar:0.5, fat:3, kcal:30 },
  { cat:"소스·양념", key:"저칼로리 바베큐", aliases:["저칼로리 바베큐","제로바베큐"], unit:"count", baseQty:1, protein:0.2, carbs:2, sugar:0, fat:0, kcal:10 },
  { cat:"소스·양념", key:"저칼로리 스테이크소스", aliases:["저칼로리 스테이크소스"], unit:"count", baseQty:1, protein:0.3, carbs:1.5, sugar:0, fat:0, kcal:8 },
  { cat:"소스·양념", key:"저칼로리 돈까스소스", aliases:["저칼로리 돈까스소스"], unit:"count", baseQty:1, protein:0.3, carbs:2, sugar:0, fat:0, kcal:10 },
  { cat:"소스·양념", key:"저칼로리 데리야끼", aliases:["저칼로리 데리야끼","제로데리야끼"], unit:"count", baseQty:1, protein:0.5, carbs:2, sugar:0, fat:0, kcal:10 },
  { cat:"소스·양념", key:"제로 스위트칠리", aliases:["제로 스위트칠리","저칼로리 스위트칠리"], unit:"count", baseQty:1, protein:0.1, carbs:2, sugar:0, fat:0, kcal:8 },
  { cat:"소스·양념", key:"데리야끼소스", aliases:["데리야끼소스","데리야끼"], unit:"count", baseQty:1, protein:0.6, carbs:6, sugar:5, fat:0, kcal:28 },
];
const KOREAN_NUM = { "한":1, "하나":1, "두":2, "세":3, "네":4, "다섯":5, "여섯":6 };
const COUNT_UNITS = "마리|개|조각|스쿱|공기|인분|줄|봉지|봉|잔|캔|알|모|덩이|덩어리|장|판|쪽|컵|병|팩|그릇|접시|스푼|숟갈|큰술|작은술|주먹|쌈|점|개입";

// 세그먼트에서 "수량"을 통합 추출. 지원: 1/3, 3분의 1, 0.5, 1.5, 두개반, 2개반, 반, 두 개
// 반환: 숫자 or null(수량 표현 없음)
function extractQty(segment, unitPattern) {
  const U = unitPattern;
  let m;
  // 1) 분수 + 단위: "1/3마리", "2 / 3 개"
  m = segment.match(new RegExp(`(\\d+)\\s*/\\s*(\\d+)\\s*(?:${U})`));
  if (m) return parseInt(m[1],10) / parseInt(m[2],10);
  // 2) 한글 분수: "3분의 1(마리)" — 단위 없어도 인정
  m = segment.match(/(\d+)\s*분의\s*(\d+)/);
  if (m) return parseInt(m[2],10) / parseInt(m[1],10);
  // 3) 숫자+단위+반: "2개반", "1마리반" → n + 0.5
  m = segment.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${U})\\s*반`));
  if (m) return parseFloat(m[1]) + 0.5;
  // 4) 한글숫자+단위+반: "두개반" → 2.5
  for (const [word, val] of Object.entries(KOREAN_NUM)) {
    if (new RegExp(`${word}\\s*(?:${U})\\s*반`).test(segment)) return val + 0.5;
  }
  // 5) 소수/정수 + 단위: "0.5개", "1.5조각", "3마리"
  m = segment.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${U})`));
  if (m) return parseFloat(m[1]);
  // 6) 반 + 단위: "반마리", "반 공기"
  if (new RegExp(`반\\s*(?:${U})`).test(segment)) return 0.5;
  // 7) 한글숫자 + 단위: "두개", "세 조각"
  for (const [word, val] of Object.entries(KOREAN_NUM)) {
    if (new RegExp(`${word}\\s*(?:${U})`).test(segment)) return val;
  }
  // 8) 단위 없는 분수/소수 (음식명 뒤 숫자만): "계란 1/2", "계란 0.5"
  m = segment.match(/\s(\d+)\s*\/\s*(\d+)\s*$/);
  if (m) return parseInt(m[1],10) / parseInt(m[2],10);
  m = segment.match(/\s(0\.\d+|\d+\.\d+)\s*$/);
  if (m) return parseFloat(m[1]);
  return null;
}

// 카테고리별 1인분(1개) 평균 무게(g) — count 음식에 g 단위 입력 시 환산용 근사치
const DEFAULT_GRAMS_BY_CAT = {
  "한식":350, "국·탕":450, "면류":500, "분식":300, "중식":350, "일식":350, "아시안":350,
  "샐러드·건강식":250, "고기·구이":150, "치킨":950, "버거":230, "피자":120, "빵류":90,
  "편의점":200, "카페":355, "음료":350, "술·안주":300, "간식":60, "디저트":100,
  "반찬·야채":80, "과일":150, "유제품·보충제":250, "기본재료":100, "기타":300,
};

// ===== 계량 기준점 (눈대중 도우미) =====
// "얼마나 먹었는지" 감을 잡기 위한 일상 기준. 손은 항상 가지고 다니고 체격에 비례해서 꽤 쓸만하다.
export const HAND_GUIDE = [
  { icon:"✊", name:"주먹 1개",   amount:"밥 1공기 ≈ 210g", note:"탄수화물 — 밥·면·감자", grams:210 },
  { icon:"🤚", name:"손바닥 1개", amount:"고기·생선 ≈ 100g", note:"단백질 — 손가락 뺀 두께 포함", grams:100 },
  { icon:"👍", name:"엄지 1개",   amount:"기름·버터 ≈ 15g",  note:"지방 — 견과류는 한 줌 ≈ 30g", grams:15 },
  { icon:"🤲", name:"두 손 가득", amount:"잎채소 ≈ 70g",     note:"채소 — 익히면 부피가 줄어요", grams:70 },
];
// 집에 흔한 그릇·도구 기준
export const CONTAINER_GUIDE = [
  { name:"밥공기(공깃밥)", amount:"밥 210g", grams:210 },
  { name:"국그릇 가득",     amount:"400~450ml", grams:420 },
  { name:"종이컵",         amount:"180ml", grams:180 },
  { name:"머그컵",         amount:"250ml", grams:250 },
  { name:"밥숟가락",       amount:"약 15g (1큰술)", grams:15 },
  { name:"티스푼",         amount:"약 5g (1작은술)", grams:5 },
];
// 카테고리별로 "보통 1인분이 이 정도" — 새 음식 등록할 때 감을 잡는 용도
export const CAT_PORTION_HINT = {
  "한식":"백반 한 그릇 ≈ 350g", "국·탕":"국그릇 하나 ≈ 450g", "면류":"라면·국수 1인분 ≈ 500g",
  "분식":"떡볶이 1인분 ≈ 300g", "중식":"짜장면 한 그릇 ≈ 350g", "일식":"덮밥 하나 ≈ 350g",
  "샐러드·건강식":"샐러드볼 하나 ≈ 250g", "고기·구이":"손바닥 크기 ≈ 100~150g",
  "치킨":"한 마리 ≈ 950g (한 조각 ≈ 90g)", "버거":"단품 하나 ≈ 230g", "피자":"한 조각 ≈ 120g",
  "빵류":"식빵 1장 ≈ 35g, 크루아상 ≈ 60g", "편의점":"도시락 하나 ≈ 400g, 삼각김밥 ≈ 100g",
  "카페":"톨 사이즈 ≈ 355ml", "음료":"캔 250ml, 페트 500ml",
  "간식":"과자 한 봉 ≈ 60g", "디저트":"조각케이크 ≈ 100g",
  "반찬·야채":"작은 종지 하나 ≈ 80g", "과일":"사과 1개 ≈ 200g, 바나나 1개 ≈ 120g",
  "유제품·보충제":"우유 1팩 200ml, 프로틴 1스쿱 ≈ 30g",
  "기본재료":"조리 전 100g 기준", "소스·양념":"1큰술 ≈ 15g",
};
// g 수치를 익숙한 것에 빗대어 설명 — "350g이 대체 얼마야?"를 풀어준다
export function portionHint(grams, cat) {
  const g = Number(grams) || 0;
  if (g <= 0) return null;
  if (cat === "소스·양념") return `밥숟가락 약 ${Math.max(1, Math.round(g/15))}큰술`;
  if (cat === "카페" || cat === "음료") {
    if (g >= 300) return `종이컵 약 ${(g/180).toFixed(1)}컵`;
    return `머그컵 약 ${(g/250).toFixed(1)}컵`;
  }
  if (cat === "고기·구이" || cat === "기본재료") {
    const palms = g/100;
    return palms < 0.8 ? `손바닥 절반 정도` : `손바닥 약 ${palms.toFixed(1)}개 크기`;
  }
  if (["한식","국·탕","면류","분식","중식","일식","아시안","편의점"].includes(cat)) {
    return `밥공기 약 ${(g/210).toFixed(1)}개 분량`;
  }
  if (cat === "과일") {
    // 주먹 하나가 사과 1개(약 200g) 정도
    return g < 130 ? `바나나 1개 정도` : `주먹 약 ${(g/200).toFixed(1)}개 크기`;
  }
  if (cat === "간식" || cat === "디저트" || cat === "빵류") {
    return `두 손 오므린 정도 (${g}g)`;
  }
  if (cat === "반찬·야채") {
    return `작은 종지 약 ${(g/80).toFixed(1)}개`;
  }
  // 그 외는 가장 가까운 기준으로
  if (g < 20) return `밥숟가락 약 ${Math.max(1, Math.round(g/15))}큰술`;
  if (g < 120) return `손바닥 약 ${(g/100).toFixed(1)}개 크기`;
  return `밥공기 약 ${(g/210).toFixed(1)}개 분량`;
}

// 이 음식의 "1인분(1개/1회분)"이 몇 g인지 반환. 명시값 > 밥 등 gramsPerUnit > 카테고리 평균 순.
export function gramsPerServing(entry) {
  if (entry.gramsPerServing) return entry.gramsPerServing;
  if (entry.unit === "gram") return entry.baseQty;
  if (entry.gramsPerUnit) return entry.gramsPerUnit;
  return DEFAULT_GRAMS_BY_CAT[entry.cat] || 300;
}

function parseAmountForEntry(segment, entry) {
  if (entry.unit === "gram") {
    // 그램 단위: kg → g 순으로, 분수도 지원 ("1/2kg")
    let m = segment.match(/(\d+)\s*\/\s*(\d+)\s*kg/i);
    if (m) return (parseInt(m[1],10)/parseInt(m[2],10)*1000) / entry.baseQty;
    m = segment.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (m) return (parseFloat(m[1]) * 1000) / entry.baseQty;
    m = segment.match(/(\d+(?:\.\d+)?)\s*(?:g|그램)/i);
    if (m) return parseFloat(m[1]) / entry.baseQty;
    // g 단위 음식인데 "인분/개" 등으로 말한 경우 → 기준량(baseQty)을 1인분으로 간주
    // 예: 닭가슴살(100g 기준) 2인분 → 200g
    const qtyG = extractQty(segment, COUNT_UNITS);
    if (qtyG != null && qtyG > 0) return qtyG;
    return 1;
  }
  // count 기반이지만 그램으로 말한 경우 — gramsPerUnit(정확) → 카테고리 평균(근사) 순으로 환산
  // 예: 제육볶음(1인분≈350g) 200g → 0.57인분
  const perUnit = entry.gramsPerServing || entry.gramsPerUnit || DEFAULT_GRAMS_BY_CAT[entry.cat] || 300;
  let gm = segment.match(/(\d+)\s*\/\s*(\d+)\s*kg/i);
  if (gm) return (parseInt(gm[1],10)/parseInt(gm[2],10)*1000) / perUnit;
  gm = segment.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (gm) return (parseFloat(gm[1]) * 1000) / perUnit;
  gm = segment.match(/(\d+(?:\.\d+)?)\s*(?:g|그램)/i);
  if (gm) return parseFloat(gm[1]) / perUnit;
  const qty = extractQty(segment, COUNT_UNITS);
  if (qty != null && qty > 0) return qty / entry.baseQty;
  return 1; // 수량 언급 없으면 기본 1회분
}

function matchEntry(segment, entries) {
  const segNorm = segment.toLowerCase().replace(/\s+/g, "");
  let best = null, bestLen = 0;
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      const aNorm = alias.toLowerCase().replace(/\s+/g, "");
      // 공백 제거 후 포함 여부로 매칭 (더 긴 별칭 우선)
      if (segNorm.includes(aNorm) && aNorm.length > bestLen) { best = entry; bestLen = aNorm.length; }
    }
  }
  return best;
}

// 자연어 텍스트를 세그먼트로 나눠 로컬 DB에서 매칭되는 만큼 즉시(무료) 계산.
// customEntries: 사용자가 직접 추가한 음식 목록 (기본 DB보다 우선 매칭)
// 매칭 안 된 부분은 unmatched로 반환해서 AI 보완 또는 직접입력으로 유도.
export function lookupLocalFoods(text, customEntries = []) {
  const overrideKeys = new Set(customEntries.map((e)=>e.key));
  const all = [...customEntries, ...FOOD_DB.filter((e)=>!overrideKeys.has(e.key))];
  const segments = text.split(/[,\n·、]/).map((s) => s.trim()).filter(Boolean);
  const matched = [];
  const unmatched = [];
  for (const seg of segments) {
    const entry = matchEntry(seg, all);
    if (!entry) { unmatched.push(seg); continue; }
    const mult = parseAmountForEntry(seg, entry);
    matched.push({
      name: seg,
      protein: Math.round(entry.protein * mult),
      carbs: Math.round(entry.carbs * mult),
      sugar: Math.round(entry.sugar * mult),
      fat: Math.round(entry.fat * mult),
      kcal: Math.round(entry.kcal * mult),
      liquidMl: entry.liquidMl ? (entry.fixedLiquid ? entry.liquidMl : Math.round(entry.liquidMl * mult)) : 0,
    });
  }
  return { matched, unmatched };
}

// 브랜드/메뉴명으로 로컬 DB 검색 (외식 탭에서 API 키 없을 때 폴백용)
export function localBrandSearch(text, customEntries = []) {
  const all = [...customEntries, ...FOOD_DB];
  const q = text.trim();
  if (!q) return [];
  return all.filter((e) =>
    (e.brand && (q.includes(e.brand) || e.brand.includes(q))) ||
    e.aliases.some((a) => q.includes(a) || a.includes(q))
  );
}

// ===== 카테고리 묶음 (가로 스크롤 대신 2단계로) =====
// 24개를 한 줄에 늘어놓으면 뒤쪽이 안 보여서, 큰 갈래로 먼저 고르게 한다.
export const CATEGORY_GROUPS = [
  { key:"집밥",   icon:"🍚", color:"#FF7A45", cats:["한식","반찬·야채","국·탕","분식"] },
  { key:"외식",   icon:"🍜", color:"#FFC24B", cats:["면류","중식","일식","아시안","고기·구이","샐러드·건강식"] },
  { key:"배달·패스트푸드", icon:"🍗", color:"#FF6B6B", cats:["치킨","버거","피자"] },
  { key:"간식·음료", icon:"🍫", color:"#C9A6FF", cats:["간식","디저트","빵류","카페","음료","술·안주","편의점"] },
  { key:"재료·보충제", icon:"💪", color:"#B6E34B", cats:["기본재료","유제품·보충제","과일","소스·양념"] },
];
export const CAT_ICON = {
  "한식":"🍚","반찬·야채":"🥬","국·탕":"🍲","분식":"🌭","면류":"🍜","중식":"🥟","일식":"🍣",
  "아시안":"🍛","고기·구이":"🥩","샐러드·건강식":"🥗","치킨":"🍗","버거":"🍔","피자":"🍕",
  "간식":"🍪","디저트":"🍰","빵류":"🥐","카페":"☕","음료":"🥤","술·안주":"🍺","편의점":"🏪",
  "기본재료":"🥚","유제품·보충제":"🥛","과일":"🍎","소스·양념":"🧂","기타":"🍽","내 음식":"⭐",
};
export const catIcon = (c)=> CAT_ICON[c] || "🍽";
// 각 카테고리에 몇 개가 들어있는지 (헛클릭 방지용 배지)
export function categoryCounts(customEntries = []) {
  const out = {};
  const overrideKeys = new Set(customEntries.map((e)=>e.key));
  for (const e of FOOD_DB) { if (overrideKeys.has(e.key)) continue; out[e.cat] = (out[e.cat]||0)+1; }
  for (const e of customEntries) { const c = normCat(e); out[c] = (out[c]||0)+1; }
  out["내 음식"] = customEntries.length;
  return out;
}
// 기록한 음식 이름으로 카테고리 사용 횟수를 센다 — 자주 쓰는 분류를 앞에 두기 위함
export function categoryUsage(schedule, customEntries = []) {
  const overrideKeys = new Set(customEntries.map((e)=>e.key));
  const nameToCat = new Map();
  for (const e of [...customEntries, ...FOOD_DB.filter((x)=>!overrideKeys.has(x.key))]) {
    const c = normCat(e);
    nameToCat.set(String(e.key).trim(), c);
    for (const a of (e.aliases||[])) nameToCat.set(String(a).trim(), c);
  }
  const counts = {};
  for (const dk of Object.keys(schedule||{})) {
    for (const f of (schedule[dk]?.foods || [])) {
      const raw = String(f.name||"").trim();
      // "닭가슴살 1.5인분"처럼 뒤에 수량이 붙는 경우까지 잡는다
      let cat = nameToCat.get(raw);
      if (!cat) {
        for (const [k, v] of nameToCat) {
          if (raw.startsWith(k)) { cat = v; break; }
        }
      }
      if (cat) counts[cat] = (counts[cat]||0) + 1;
    }
  }
  return counts;
}

// 영양 기준 빠른 필터 — 카테고리보다 이게 더 쓸모 있을 때가 많다
export const NUTRI_FILTERS = [
  { key:"highProtein", label:"고단백", icon:"🥩", color:"#B6E34B",
    desc:"100kcal당 단백질 10g 이상", test:(e)=> e.kcal>0 && (e.protein/e.kcal*100) >= 10 },
  { key:"lowCal", label:"저칼로리", icon:"🪶", color:"#35C4D8",
    desc:"1회분 150kcal 이하", test:(e)=> e.kcal>0 && e.kcal <= 150 },
  { key:"lowFat", label:"저지방", icon:"💧", color:"#6BA8FF",
    desc:"지방이 전체 칼로리의 25% 이하", test:(e)=> e.kcal>0 && (e.fat*9/e.kcal) <= 0.25 },
  { key:"lowSugar", label:"저당", icon:"🚫", color:"#FF8FB0",
    desc:"1회분 당류 5g 이하", test:(e)=> (e.sugar||0) <= 5 },
];
// 단백질 효율 — 같은 칼로리로 단백질을 얼마나 얻는지 (벌크·컷 모두에서 유용)
export const proteinPer100kcal = (e)=> (e.kcal>0 ? Math.round(e.protein/e.kcal*100*10)/10 : 0);

// 내 음식 등록 시 선택 가능한 카테고리 목록
export const CATEGORIES = ["기본재료", "유제품·보충제", "한식", "반찬·야채", "국·탕", "면류", "분식", "중식", "일식", "아시안", "치킨", "버거", "피자", "빵류", "샐러드·건강식", "고기·구이", "과일", "소스·양념", "편의점", "카페", "음료", "술·안주", "디저트", "간식", "기타"];

// 사용자가 이름+영양성분을 입력해 만드는 커스텀 음식 항목 생성 헬퍼
// cat: 사용자가 고른 카테고리 (없으면 "기타")
export function makeCustomEntry({ name, cat, protein, carbs, sugar, fat, kcal, liquidMl, fixedLiquid, gramsPerServing }) {
  const e = { cat: cat || "기타", key: name, aliases: [name], unit: "count", baseQty: 1, protein, carbs, sugar, fat, kcal, custom: true };
  if (liquidMl && liquidMl > 0) { e.liquidMl = liquidMl; if (fixedLiquid) e.fixedLiquid = true; }
  if (gramsPerServing && gramsPerServing > 0) e.gramsPerServing = gramsPerServing; // 1인분이 몇 g인지 직접 지정
  return e;
}

// 예전 버전에서 저장된 커스텀 음식(cat이 "내 음식")을 "기타"로 보정
const normCat = (e) => (e.custom && (!e.cat || e.cat === "내 음식") ? "기타" : e.cat);

// 음식 탭 전용: 기본 DB + 내 음식을 합쳐서 검색/필터링
// category === "내 음식" 이면 내가 등록한 것만, 그 외에는 해당 카테고리(내 음식 포함)로 필터.
// 검색용 정규화: 공백 제거 + 소문자
const normSearch = (s) => (s||"").toLowerCase().replace(/\s+/g, "");

// 한글 초성 추출 (예: "제육볶음" → "ㅈㅇㅂㅇ")
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const toChosung = (s) => {
  let out = "";
  for (const ch of (s||"")) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code >= 0 && code < 11172) out += CHO[Math.floor(code/588)];
    else out += ch;
  }
  return out;
};

export function searchAllFoods(query = "", customEntries = [], category = null) {
  const overrideKeys = new Set(customEntries.map((e)=>e.key));
  const all = [...customEntries, ...FOOD_DB.filter((e)=>!overrideKeys.has(e.key))];
  const qRaw = query.trim();
  const q = normSearch(qRaw);
  const isChosungQuery = /^[ㄱ-ㅎ]+$/.test(qRaw.replace(/\s+/g,"")); // 초성만 입력한 경우
  const scored = [];
  for (const e of all) {
    if (category === "내 음식") { if (!e.custom) continue; }
    else if (category && normCat(e) !== category) continue;
    if (!q) { scored.push([0, e]); continue; }

    const fields = [e.key, e.brand||"", ...e.aliases];
    let score = -1;
    for (const f of fields) {
      const nf = normSearch(f);
      if (!nf) continue;
      if (nf === q) { score = Math.max(score, 100); break; }         // 완전일치
      if (nf.startsWith(q)) score = Math.max(score, 80);              // 시작일치
      else if (nf.includes(q)) score = Math.max(score, 60);          // 부분포함
      // 초성 검색
      if (isChosungQuery && toChosung(nf).includes(qRaw.replace(/\s+/g,""))) score = Math.max(score, 40);
    }
    if (score >= 0) scored.push([score, e]);
  }
  // 점수 높은 순, 동점이면 원래 순서 유지
  return scored.sort((a,b)=> b[0]-a[0]).map(([,e])=>e);
}


// 1회 제공량 표기 (카테고리별 자연스러운 단위로)
const SERVING_BY_CAT = {
  "치킨": "1마리 기준",
  "피자": "1조각 기준",
  "버거": "1개 기준",
  "빵류": "1개 기준",
  "카페": "1잔 기준",
  "음료": "1잔 기준",
  "간식": "1개 기준",
  "편의점": "1개 기준",
  "유제품·보충제": "1회분 기준",
  "분식": "1인분 기준",
  "중식": "1인분 기준",
  "일식": "1인분 기준",
  "아시안": "1인분 기준",
  "샐러드·건강식": "1인분 기준",
  "반찬·야채": "1인분 기준",
  "국·탕": "1인분 기준",
  "면류": "1인분 기준",
  "고기·구이": "1인분(150g) 기준",
  "과일": "1회분 기준",
  "소스·양념": "1큰술(≈동전크기) 기준",
  "디저트": "1개 기준",
  "술·안주": "1잔/1인분 기준",
};
export function servingLabel(entry) {
  const g = gramsPerServing(entry);
  if (entry.unit === "gram") return `${entry.baseQty}g 기준`;
  if (entry.cat === "소스·양념") return "1큰술(≈15g) 기준";
  const base = (entry.custom ? "1인분 기준" : (SERVING_BY_CAT[entry.cat] || "1인분 기준"));
  const isDrink = ["음료","카페"].includes(entry.cat) || entry.liquidMl>0;
  // 직접 지정한 값(gramsPerServing/liquidMl)은 근사(≈) 없이 정확한 값으로 표기
  const exact = isDrink ? !!entry.liquidMl : !!entry.gramsPerServing;
  const tilde = exact ? "" : "≈";
  const amount = isDrink ? `${tilde}${entry.liquidMl||g}ml` : `${tilde}${g}g`;
  // "1인분 기준" → "1인분(≈350g) 기준", "1잔 기준" → "1잔(≈355ml) 기준"
  return base.replace(/(1[^\s(]*)(\s*기준)/, `$1(${amount})$2`);
}

// 목록에 표시할 카테고리명 (예전 "내 음식" 저장분은 "기타"로)
export function displayCat(entry) {
  return normCat(entry);
}
