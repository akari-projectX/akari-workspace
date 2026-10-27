INSERT INTO access_settings (id) VALUES (1);
INSERT INTO agent_update_settings (id) VALUES (true);
INSERT INTO alert_settings (id) VALUES (1);
INSERT INTO auth_settings (id) VALUES (1);
INSERT INTO cleanup_settings (id) VALUES (1);
INSERT INTO commission_settings (id) VALUES (1);
INSERT INTO mail_settings (id) VALUES (1);
INSERT INTO panel_settings (id) VALUES (1);
INSERT INTO signup_settings (id) VALUES (1);
INSERT INTO site_branding (id) VALUES (1);

-- The built-in audit rule sets: only switched on or off and ordered by the
-- operator, never created or deleted.
INSERT INTO block_rules (kind, builtin_key, name, enabled, sort) VALUES
    ('builtin', 'bittorrent', 'BitTorrent 协议识别', true, -30),
    ('builtin', 'bt_tracker', 'BT Tracker 域名', true, -20),
    ('builtin', 'xunlei_pt', '迅雷 / PT 站域名', false, -10);

-- Announcement tag presets.
INSERT INTO announcement_tags (name_zh, name_en, color, sort) VALUES
    ('活动', 'Event', 'pink', 0),
    ('维护', 'Maintenance', 'amber', 1),
    ('调整', 'Change', 'blue', 2),
    ('新功能', 'New feature', 'violet', 3),
    ('优惠', 'Offer', 'green', 4),
    ('重要', 'Important', 'red', 5),
    ('新线路', 'New route', 'teal', 6),
    ('通知', 'Notice', 'slate', 7);
