ALTER TABLE tickets
    ADD COLUMN input_app_id INTEGER REFERENCES apps(id),
    ADD COLUMN output_app_id INTEGER REFERENCES apps(id);

CREATE INDEX idx_tickets_input_app ON tickets(input_app_id);
CREATE INDEX idx_tickets_output_app ON tickets(output_app_id);
