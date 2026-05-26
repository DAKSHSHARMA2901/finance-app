-- Safe query runner for AI querying (only allows SELECT statements)
CREATE OR REPLACE FUNCTION run_safe_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  normalized TEXT;
BEGIN
  normalized := TRIM(UPPER(query_text));

  -- Allow only SELECT and WITH (CTEs starting with SELECT)
  IF normalized !~ '^(SELECT|WITH)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous keywords
  IF normalized ~ '\m(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|DO)\M' THEN
    RAISE EXCEPTION 'Forbidden SQL keyword detected';
  END IF;

  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant to authenticated users
GRANT EXECUTE ON FUNCTION run_safe_query(TEXT) TO authenticated;

-- Sample data for testing
INSERT INTO customers (name, email, phone) VALUES
  ('Acme Corp', 'billing@acme.com', '+1-555-0101'),
  ('TechStart Ltd', 'finance@techstart.io', '+1-555-0102'),
  ('Global Traders', 'accounts@globaltraders.com', '+1-555-0103')
ON CONFLICT DO NOTHING;

INSERT INTO suppliers (name, email) VALUES
  ('Office Supplies Co', 'orders@officesupplies.com'),
  ('Cloud Services Inc', 'billing@cloudservices.com')
ON CONFLICT DO NOTHING;

INSERT INTO products (name, unit_price, sku) VALUES
  ('Software License', 299.00, 'SW-LIC-001'),
  ('Consulting (hourly)', 150.00, 'CONSULT-HR'),
  ('Printer Paper (ream)', 12.99, 'PP-A4-500')
ON CONFLICT DO NOTHING;
