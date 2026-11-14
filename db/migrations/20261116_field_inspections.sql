-- Field Inspections Table for NEMA Section 107 physical ground verification
CREATE TABLE IF NOT EXISTS field_inspections (
  id                  text PRIMARY KEY,
  report_id           text NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  ranger_email        text NOT NULL,
  certificate_number  text NOT NULL,
  lat                 double precision NOT NULL,
  lng                 double precision NOT NULL,
  distance_m          double precision NOT NULL,
  photo_url           text,
  water_ph            numeric(3, 1),
  water_clarity       text CHECK (water_clarity IN ('clear', 'murky_clay', 'chemical_opaque', 'oil_sheen')),
  odor                text CHECK (odor IN ('natural_earth', 'raw_sewage', 'chemical_solvent', 'burning', 'none')),
  findings_summary    text,
  action_recommended  text CHECK (action_recommended IN ('restoration_order', 'stop_notice', 'environmental_police_escort', 'no_violation_natural_runoff', 'refer_to_local_council')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_inspections_report ON field_inspections (report_id);
CREATE INDEX IF NOT EXISTS idx_field_inspections_cert ON field_inspections (certificate_number);
