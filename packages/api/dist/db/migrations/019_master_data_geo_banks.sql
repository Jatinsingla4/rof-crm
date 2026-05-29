-- Migration 019: Geographic master data (Country, State, City) and Banks

CREATE TABLE IF NOT EXISTS countries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL UNIQUE,
  code       VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO countries (name, code) VALUES
  ('India', 'IN'), ('USA', 'US'), ('UK', 'GB'), ('UAE', 'AE'),
  ('Canada', 'CA'), ('Australia', 'AU'), ('Singapore', 'SG')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS states (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(150) NOT NULL,
  country_id  UUID REFERENCES countries(id) ON DELETE CASCADE,
  code        VARCHAR(10),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, country_id)
);
INSERT INTO states (name, country_id, code)
SELECT s.name, c.id, s.code FROM (VALUES
  ('Haryana',          'IN', 'HR'),
  ('Delhi',            'IN', 'DL'),
  ('Uttar Pradesh',    'IN', 'UP'),
  ('Rajasthan',        'IN', 'RJ'),
  ('Punjab',           'IN', 'PB'),
  ('Maharashtra',      'IN', 'MH'),
  ('Karnataka',        'IN', 'KA'),
  ('Tamil Nadu',       'IN', 'TN'),
  ('Gujarat',          'IN', 'GJ'),
  ('Madhya Pradesh',   'IN', 'MP'),
  ('West Bengal',      'IN', 'WB'),
  ('Telangana',        'IN', 'TG'),
  ('Himachal Pradesh', 'IN', 'HP'),
  ('Uttarakhand',      'IN', 'UK')
) AS s(name, country_code, code)
JOIN countries c ON c.code = s.country_code
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS cities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(150) NOT NULL,
  state_id   UUID REFERENCES states(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, state_id)
);
INSERT INTO cities (name, state_id)
SELECT c.name, s.id FROM (VALUES
  ('Gurugram',   'Haryana'),
  ('Faridabad',  'Haryana'),
  ('Ambala',     'Haryana'),
  ('Karnal',     'Haryana'),
  ('Panipat',    'Haryana'),
  ('Sonipat',    'Haryana'),
  ('Rohtak',     'Haryana'),
  ('Hisar',      'Haryana'),
  ('New Delhi',  'Delhi'),
  ('Noida',      'Uttar Pradesh'),
  ('Ghaziabad',  'Uttar Pradesh'),
  ('Agra',       'Uttar Pradesh'),
  ('Jaipur',     'Rajasthan'),
  ('Jodhpur',    'Rajasthan'),
  ('Chandigarh', 'Punjab'),
  ('Ludhiana',   'Punjab'),
  ('Amritsar',   'Punjab')
) AS c(name, state_name)
JOIN states s ON s.name = c.state_name
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS banks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(200) NOT NULL UNIQUE,
  ifsc_prefix VARCHAR(10),
  branch     VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO banks (name, ifsc_prefix) VALUES
  ('State Bank of India',    'SBIN'),
  ('Punjab National Bank',   'PUNB'),
  ('HDFC Bank',              'HDFC'),
  ('ICICI Bank',             'ICIC'),
  ('Axis Bank',              'UTIB'),
  ('Kotak Mahindra Bank',    'KKBK'),
  ('Bank of Baroda',         'BARB'),
  ('Canara Bank',            'CNRB'),
  ('Union Bank of India',    'UBIN'),
  ('IndusInd Bank',          'INDB'),
  ('YES Bank',               'YESB'),
  ('IDFC First Bank',        'IDFB'),
  ('Bank of India',          'BKID'),
  ('Central Bank of India',  'CBIN'),
  ('Indian Bank',            'IDIB'),
  ('UCO Bank',               'UCBA')
ON CONFLICT DO NOTHING;
