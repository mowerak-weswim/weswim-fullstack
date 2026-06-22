-- Dev/sample venues for group find and search
INSERT INTO venues (venue_id, sport_type, name, region, address, canonical_key, status, activated_at)
VALUES
  (
    'a0000001-0000-4000-8000-000000000001',
    'swimming',
    '잠실실내수영장',
    '서울 송파',
    '서울 송파구 올림픽로 25',
    'swimming:잠실실내수영장',
    'active',
    NOW()
  ),
  (
    'a0000001-0000-4000-8000-000000000002',
    'swimming',
    '태릉국제수영장',
    '서울 노원',
    '서울 노원구 화랑로 424',
    'swimming:태릉국제수영장',
    'active',
    NOW()
  ),
  (
    'a0000001-0000-4000-8000-000000000003',
    'swimming',
    '문성수영장',
    '서울 강남',
    '서울 강남구 언주로 726',
    'swimming:문성수영장',
    'active',
    NOW()
  )
ON CONFLICT (venue_id) DO NOTHING;
