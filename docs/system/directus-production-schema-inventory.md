# Directus Production Schema Inventory

Generated from live database at `2026-05-05T11:21:02.650Z`.

Source context:

- App container: `directus-production`
- DB container: `directus-production-db`
- Database: `directus`
- PostgreSQL: `PostgreSQL 16.13 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit`

## Snapshot

- custom_collections: 15
- directus_fields: 212
- directus_relations: 43
- public_tables: 44

## Custom Collections Metadata

| collection                        | icon                   | accountability | sort | display_template                                             | note                                                                                |
| --------------------------------- | ---------------------- | -------------: | ---: | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| gw_business_partner_bank_accounts | account_balance        |            all |  203 |                                                              | Greenway partner bank accounts.                                                     |
| gw_business_partner_contacts      | contact_phone          |            all |  202 |                                                              | Greenway partner contacts and actual payer/receiver.                                |
| gw_business_partner_roles         | badge                  |            all |  201 |                                                              | Greenway business partner roles.                                                    |
| gw_business_partners              | groups                 |            all |  200 | {{code}} - {{name}}                                          | Greenway external business partner master. Internal employees live in gw_employees. |
| gw_cash_funds                     | payments               |            all |  205 | {{fund_code}} - {{fund_name}}                                | Greenway company cash funds.                                                        |
| gw_chart_of_accounts              | account_tree           |            all |  204 | {{account_code}} - {{account_name}}                          | Greenway chart of accounts.                                                         |
| gw_company_bank_accounts          | account_balance_wallet |            all |  206 | {{bank_name}} - {{account_number}}                           | Greenway company bank accounts.                                                     |
| gw_departments                    | corporate_fare         |            all |  212 | {{department_code}} - {{department_name}}                    | Greenway internal departments and organizational units.                             |
| gw_employees                      | groups                 |            all |  214 | {{employee_code}} - {{full_name}}                            | Greenway employee master for internal operations.                                   |
| gw_opening_balances               | balance                |            all |  207 |                                                              | Greenway opening balances.                                                          |
| gw_payment_voucher_approval_logs  | fact_check             |            all |  210 |                                                              | Greenway voucher approval logs.                                                     |
| gw_payment_voucher_attachments    | attach_file            |            all |  209 |                                                              | Greenway voucher attachments.                                                       |
| gw_payment_vouchers               | receipt_long           |            all |  208 | {{voucher_no}} - {{counterparty_name_snapshot}} - {{amount}} | Greenway payment vouchers.                                                          |
| gw_positions                      | badge                  |            all |  213 | {{position_code}} - {{position_name}}                        | Greenway positions and business roles.                                              |
| gw_voucher_numbering_configs      | pin                    |            all |  211 |                                                              | Greenway voucher numbering configs.                                                 |

## Public Tables Summary

| table                             | category | columns | directus_field_meta |
| --------------------------------- | -------- | ------: | ------------------: |
| directus_access                   | system   |       5 |                   0 |
| directus_activity                 | system   |       9 |                   0 |
| directus_collections              | system   |      20 |                   0 |
| directus_comments                 | system   |       8 |                   0 |
| directus_dashboards               | system   |       7 |                   0 |
| directus_deployment_projects      | system   |       9 |                   0 |
| directus_deployment_runs          | system   |      10 |                   0 |
| directus_deployments              | system   |       9 |                   0 |
| directus_extensions               | system   |       5 |                   0 |
| directus_fields                   | system   |      20 |                   0 |
| directus_files                    | system   |      26 |                   0 |
| directus_flows                    | system   |      12 |                   0 |
| directus_folders                  | system   |       3 |                   0 |
| directus_migrations               | system   |       3 |                   0 |
| directus_notifications            | system   |       9 |                   0 |
| directus_operations               | system   |      12 |                   0 |
| directus_panels                   | system   |      15 |                   0 |
| directus_permissions              | system   |       8 |                   0 |
| directus_policies                 | system   |       8 |                   0 |
| directus_presets                  | system   |      13 |                   0 |
| directus_relations                | system   |      10 |                   0 |
| directus_revisions                | system   |       8 |                   0 |
| directus_roles                    | system   |       5 |                   0 |
| directus_sessions                 | system   |       8 |                   0 |
| directus_settings                 | system   |      58 |                   0 |
| directus_shares                   | system   |      12 |                   0 |
| directus_translations             | system   |       4 |                   0 |
| directus_users                    | system   |      27 |                   0 |
| directus_versions                 | system   |      11 |                   0 |
| gw_business_partner_bank_accounts | business |      11 |                  11 |
| gw_business_partner_contacts      | business |      13 |                  13 |
| gw_business_partner_roles         | business |       7 |                   7 |
| gw_business_partners              | business |      19 |                  19 |
| gw_cash_funds                     | business |      10 |                  10 |
| gw_chart_of_accounts              | business |      16 |                  16 |
| gw_company_bank_accounts          | business |      13 |                  13 |
| gw_departments                    | business |      12 |                  12 |
| gw_employees                      | business |      21 |                  21 |
| gw_opening_balances               | business |      12 |                  12 |
| gw_payment_voucher_approval_logs  | business |       8 |                   8 |
| gw_payment_voucher_attachments    | business |       7 |                   7 |
| gw_payment_vouchers               | business |      40 |                  40 |
| gw_positions                      | business |      13 |                  13 |
| gw_voucher_numbering_configs      | business |      10 |                  10 |

## Directus Relations

| many_collection                   | many_field                  | one_collection                    | one_field           | one_collection_field | allowed_collections | junction_field |
| --------------------------------- | --------------------------- | --------------------------------- | ------------------- | -------------------- | ------------------- | -------------- |
| gw_business_partner_bank_accounts | business_partner_id         | gw_business_partners              | bank_accounts       |                      |                     |                |
| gw_business_partner_contacts      | business_partner_id         | gw_business_partners              | contacts            |                      |                     |                |
| gw_business_partner_roles         | business_partner_id         | gw_business_partners              | roles               |                      |                     |                |
| gw_business_partners              | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_business_partners              | updated_by                  | directus_users                    |                     |                      |                     |                |
| gw_cash_funds                     | accounting_account_id       | gw_chart_of_accounts              |                     |                      |                     |                |
| gw_cash_funds                     | responsible_user_id         | directus_users                    |                     |                      |                     |                |
| gw_chart_of_accounts              | parent_account_id           | gw_chart_of_accounts              | child_accounts      |                      |                     |                |
| gw_company_bank_accounts          | accounting_account_id       | gw_chart_of_accounts              |                     |                      |                     |                |
| gw_company_bank_accounts          | responsible_user_id         | directus_users                    |                     |                      |                     |                |
| gw_departments                    | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_departments                    | manager_employee_id         | gw_employees                      | managed_departments |                      |                     |                |
| gw_departments                    | parent_department_id        | gw_departments                    | child_departments   |                      |                     |                |
| gw_departments                    | updated_by                  | directus_users                    |                     |                      |                     |                |
| gw_employees                      | business_partner_id         | gw_business_partners              |                     |                      |                     |                |
| gw_employees                      | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_employees                      | department_id               | gw_departments                    | employees           |                      |                     |                |
| gw_employees                      | directus_user_id            | directus_users                    |                     |                      |                     |                |
| gw_employees                      | manager_employee_id         | gw_employees                      | direct_reports      |                      |                     |                |
| gw_employees                      | position_id                 | gw_positions                      | employees           |                      |                     |                |
| gw_employees                      | signature_file_id           | directus_files                    |                     |                      |                     |                |
| gw_employees                      | updated_by                  | directus_users                    |                     |                      |                     |                |
| gw_opening_balances               | account_id                  | gw_chart_of_accounts              |                     |                      |                     |                |
| gw_opening_balances               | cash_fund_id                | gw_cash_funds                     |                     |                      |                     |                |
| gw_opening_balances               | company_bank_account_id     | gw_company_bank_accounts          |                     |                      |                     |                |
| gw_opening_balances               | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_payment_voucher_approval_logs  | action_by                   | directus_users                    |                     |                      |                     |                |
| gw_payment_voucher_approval_logs  | payment_voucher_id          | gw_payment_vouchers               | approval_logs       |                      |                     |                |
| gw_payment_voucher_attachments    | file                        | directus_files                    |                     |                      |                     |                |
| gw_payment_voucher_attachments    | payment_voucher_id          | gw_payment_vouchers               | attachments         |                      |                     |                |
| gw_payment_voucher_attachments    | uploaded_by                 | directus_users                    |                     |                      |                     |                |
| gw_payment_vouchers               | approved_by                 | directus_users                    |                     |                      |                     |                |
| gw_payment_vouchers               | beneficiary_bank_account_id | gw_business_partner_bank_accounts |                     |                      |                     |                |
| gw_payment_vouchers               | cash_fund_id                | gw_cash_funds                     |                     |                      |                     |                |
| gw_payment_vouchers               | company_bank_account_id     | gw_company_bank_accounts          |                     |                      |                     |                |
| gw_payment_vouchers               | counterparty_id             | gw_business_partners              |                     |                      |                     |                |
| gw_payment_vouchers               | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_payment_vouchers               | credit_account_id           | gw_chart_of_accounts              |                     |                      |                     |                |
| gw_payment_vouchers               | debit_account_id            | gw_chart_of_accounts              |                     |                      |                     |                |
| gw_payment_vouchers               | employee_id                 | gw_employees                      |                     |                      |                     |                |
| gw_positions                      | created_by                  | directus_users                    |                     |                      |                     |                |
| gw_positions                      | department_id               | gw_departments                    | positions           |                      |                     |                |
| gw_positions                      | updated_by                  | directus_users                    |                     |                      |                     |                |

## Detailed Inventory

### directus_access

- Category: system
- Column count: 5

| column | data_type | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------ | --------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id     | uuid      | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| role   | uuid      | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| user   | uuid      | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| policy | uuid      | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| sort   | integer   | int4     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_activity

- Category: system
- Column count: 9

| column     | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ---------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id         | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| action     | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| user       | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| timestamp  | timestamp with time zone | timestamptz | NO       |         |           |         |          |          |        |                 |         |      |
| ip         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| user_agent | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| collection | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| item       | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| origin     | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_collections

- Category: system
- Column count: 20

| column                  | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ----------------------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| collection              | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| icon                    | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| note                    | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| display_template        | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| hidden                  | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| singleton               | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| translations            | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| archive_field           | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| archive_app_filter      | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| archive_value           | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| unarchive_value         | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| sort_field              | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| accountability          | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| color                   | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| item_duplication_fields | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| sort                    | integer           | int4     | YES      |         |           |         |          |          |        |                 |         |      |
| group                   | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| collapse                | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| preview_url             | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| versioning              | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_comments

- Category: system
- Column count: 8

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| collection   | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| item         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| comment      | text                     | text        | NO       |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| date_updated | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| user_updated | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |

### directus_dashboards

- Category: system
- Column count: 7

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| icon         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| note         | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| color        | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_deployment_projects

- Category: system
- Column count: 9

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| deployment   | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| external_id  | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| url          | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| framework    | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| deployable   | boolean                  | bool        | NO       |         |           |         |          |          |        |                 |         |      |

### directus_deployment_runs

- Category: system
- Column count: 10

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| project      | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| external_id  | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| target       | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| status       | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| url          | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| started_at   | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| completed_at | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |

### directus_deployments

- Category: system
- Column count: 9

| column         | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| -------------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id             | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| provider       | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| credentials    | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| options        | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| date_created   | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created   | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| webhook_ids    | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| webhook_secret | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| last_synced_at | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |

### directus_extensions

- Category: system
- Column count: 5

| column  | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| enabled | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| id      | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| folder  | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| source  | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| bundle  | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_fields

- Category: system
- Column count: 20

| column             | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------------ | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id                 | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| collection         | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| field              | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| special            | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| interface          | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| options            | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| display            | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| display_options    | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| readonly           | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| hidden             | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| sort               | integer           | int4     | YES      |         |           |         |          |          |        |                 |         |      |
| width              | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| translations       | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| note               | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| conditions         | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| required           | boolean           | bool     | YES      |         |           |         |          |          |        |                 |         |      |
| group              | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| validation         | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| validation_message | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| searchable         | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_files

- Category: system
- Column count: 26

| column            | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ----------------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id                | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| storage           | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| filename_disk     | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| filename_download | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| title             | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| type              | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| folder            | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| uploaded_by       | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| created_on        | timestamp with time zone | timestamptz | NO       |         |           |         |          |          |        |                 |         |      |
| modified_by       | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| modified_on       | timestamp with time zone | timestamptz | NO       |         |           |         |          |          |        |                 |         |      |
| charset           | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| filesize          | bigint                   | int8        | YES      |         |           |         |          |          |        |                 |         |      |
| width             | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| height            | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| duration          | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| embed             | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| description       | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| location          | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| tags              | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| metadata          | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| focal_point_x     | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| focal_point_y     | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| tus_id            | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| tus_data          | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| uploaded_on       | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |

### directus_flows

- Category: system
- Column count: 12

| column         | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| -------------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id             | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| name           | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| icon           | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| color          | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| description    | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| status         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| trigger        | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| accountability | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| options        | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| operation      | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| date_created   | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created   | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |

### directus_folders

- Category: system
- Column count: 3

| column | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------ | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id     | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| name   | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| parent | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_migrations

- Category: system
- Column count: 3

| column    | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| --------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| version   | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| name      | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| timestamp | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |

### directus_notifications

- Category: system
- Column count: 9

| column     | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ---------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id         | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| timestamp  | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| status     | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| recipient  | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| sender     | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| subject    | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| message    | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| collection | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| item       | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_operations

- Category: system
- Column count: 12

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| key          | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| type         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| position_x   | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| position_y   | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| options      | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| resolve      | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| reject       | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| flow         | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |

### directus_panels

- Category: system
- Column count: 15

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| dashboard    | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| icon         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| color        | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| show_header  | boolean                  | bool        | NO       |         |           |         |          |          |        |                 |         |      |
| note         | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| type         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| position_x   | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| position_y   | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| width        | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| height       | integer                  | int4        | NO       |         |           |         |          |          |        |                 |         |      |
| options      | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |

### directus_permissions

- Category: system
- Column count: 8

| column      | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ----------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id          | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| collection  | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| action      | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| permissions | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| validation  | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| presets     | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| fields      | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| policy      | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_policies

- Category: system
- Column count: 8

| column       | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| icon         | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| description  | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ip_access    | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| enforce_tfa  | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| admin_access | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| app_access   | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_presets

- Category: system
- Column count: 13

| column           | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ---------------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id               | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| bookmark         | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| user             | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| role             | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| collection       | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| search           | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| layout           | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| layout_query     | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| layout_options   | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| refresh_interval | integer           | int4     | YES      |         |           |         |          |          |        |                 |         |      |
| filter           | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| icon             | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| color            | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |

### directus_relations

- Category: system
- Column count: 10

| column                  | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ----------------------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id                      | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| many_collection         | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| many_field              | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| one_collection          | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| one_field               | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| one_collection_field    | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| one_allowed_collections | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| junction_field          | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| sort_field              | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| one_deselect_action     | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |

### directus_revisions

- Category: system
- Column count: 8

| column     | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ---------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id         | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| activity   | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| collection | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| item       | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| data       | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| delta      | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| parent     | integer           | int4     | YES      |         |           |         |          |          |        |                 |         |      |
| version    | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_roles

- Category: system
- Column count: 5

| column      | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ----------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id          | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| name        | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| icon        | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| description | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| parent      | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_sessions

- Category: system
- Column count: 8

| column     | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ---------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| token      | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| user       | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| expires    | timestamp with time zone | timestamptz | NO       |         |           |         |          |          |        |                 |         |      |
| ip         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| user_agent | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| share      | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| origin     | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| next_token | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |

### directus_settings

- Category: system
- Column count: 58

| column                           | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| -------------------------------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id                               | integer           | int4     | NO       |         |           |         |          |          |        |                 |         |      |
| project_name                     | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| project_url                      | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| project_color                    | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| project_logo                     | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| public_foreground                | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| public_background                | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| public_note                      | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| auth_login_attempts              | integer           | int4     | YES      |         |           |         |          |          |        |                 |         |      |
| auth_password_policy             | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| storage_asset_transform          | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| storage_asset_presets            | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| custom_css                       | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| storage_default_folder           | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| basemaps                         | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| mapbox_key                       | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| module_bar                       | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| project_descriptor               | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| default_language                 | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| custom_aspect_ratios             | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| public_favicon                   | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| default_appearance               | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| default_theme_light              | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| theme_light_overrides            | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| default_theme_dark               | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| theme_dark_overrides             | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| report_error_url                 | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| report_bug_url                   | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| report_feature_url               | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| public_registration              | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| public_registration_verify_email | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| public_registration_role         | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| public_registration_email_filter | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| visual_editor_urls               | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| project_id                       | uuid              | uuid     | YES      |         |           |         |          |          |        |                 |         |      |
| mcp_enabled                      | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| mcp_allow_deletes                | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| mcp_prompts_collection           | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| mcp_system_prompt_enabled        | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |
| mcp_system_prompt                | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| project_owner                    | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| project_usage                    | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| org_name                         | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| product_updates                  | boolean           | bool     | YES      |         |           |         |          |          |        |                 |         |      |
| project_status                   | character varying | varchar  | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_api_key                | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_anthropic_api_key             | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_system_prompt                 | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_google_api_key                | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_compatible_api_key     | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_compatible_base_url    | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_compatible_name        | text              | text     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_compatible_models      | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_compatible_headers     | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_openai_allowed_models         | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_anthropic_allowed_models      | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| ai_google_allowed_models         | json              | json     | YES      |         |           |         |          |          |        |                 |         |      |
| collaborative_editing_enabled    | boolean           | bool     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_shares

- Category: system
- Column count: 12

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| collection   | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| item         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| role         | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| password     | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| date_start   | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| date_end     | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| times_used   | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |
| max_uses     | integer                  | int4        | YES      |         |           |         |          |          |        |                 |         |      |

### directus_translations

- Category: system
- Column count: 4

| column   | data_type         | udt_name | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| -------- | ----------------- | -------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id       | uuid              | uuid     | NO       |         |           |         |          |          |        |                 |         |      |
| language | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| key      | character varying | varchar  | NO       |         |           |         |          |          |        |                 |         |      |
| value    | text              | text     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_users

- Category: system
- Column count: 27

| column                | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| --------------------- | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id                    | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| first_name            | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| last_name             | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| email                 | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| password              | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| location              | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| title                 | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| description           | text                     | text        | YES      |         |           |         |          |          |        |                 |         |      |
| tags                  | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| avatar                | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| language              | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| tfa_secret            | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| status                | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| role                  | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| token                 | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| last_access           | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| last_page             | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| provider              | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| external_identifier   | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| auth_data             | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| email_notifications   | boolean                  | bool        | YES      |         |           |         |          |          |        |                 |         |      |
| appearance            | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| theme_dark            | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| theme_light           | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| theme_light_overrides | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| theme_dark_overrides  | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |
| text_direction        | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |

### directus_versions

- Category: system
- Column count: 11

| column       | data_type                | udt_name    | nullable | special | interface | display | required | readonly | hidden | relation_target | options | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | --------- | ------- | -------- | -------- | ------ | --------------- | ------- | ---- |
| id           | uuid                     | uuid        | NO       |         |           |         |          |          |        |                 |         |      |
| key          | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| name         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| collection   | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| item         | character varying        | varchar     | NO       |         |           |         |          |          |        |                 |         |      |
| hash         | character varying        | varchar     | YES      |         |           |         |          |          |        |                 |         |      |
| date_created | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| date_updated | timestamp with time zone | timestamptz | YES      |         |           |         |          |          |        |                 |         |      |
| user_created | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| user_updated | uuid                     | uuid        | YES      |         |           |         |          |          |        |                 |         |      |
| delta        | json                     | json        | YES      |         |           |         |          |          |        |                 |         |      |

### gw_business_partner_bank_accounts

- Category: business
- Column count: 11
- Directus icon: account_balance
- Directus display template:
- Directus note: Greenway partner bank accounts.

| column              | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                    | options | note |
| ------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ---------------------------------- | ------- | ---- |
| id                  | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                    |         |      |
| business_partner_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_business_partners.bank_accounts |         |      |
| bank_name           | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                    |         |      |
| bank_branch         | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                    |         |      |
| account_number      | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                    |         |      |
| account_holder      | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                    |         |      |
| currency            | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                    |         |      |
| is_default          | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                    |         |      |
| is_active           | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                    |         |      |
| note                | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                    |         |      |
| created_at          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                    |         |      |

### gw_business_partner_contacts

- Category: business
- Column count: 13
- Directus icon: contact_phone
- Directus display template:
- Directus note: Greenway partner contacts and actual payer/receiver.

| column              | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target               | options | note |
| ------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ----------------------------- | ------- | ---- |
| id                  | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                               |         |      |
| business_partner_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_business_partners.contacts |         |      |
| full_name           | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                               |         |      |
| position            | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                               |         |      |
| phone               | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                               |         |      |
| email               | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                               |         |      |
| identity_no         | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                               |         |      |
| address             | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                               |         |      |
| is_default_receiver | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                               |         |      |
| is_default_payer    | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                               |         |      |
| is_active           | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                               |         |      |
| note                | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                               |         |      |
| created_at          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                               |         |      |

### gw_business_partner_roles

- Category: business
- Column count: 7
- Directus icon: badge
- Directus display template:
- Directus note: Greenway business partner roles.

| column              | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target            | options                                                                                                                                                                                                                                                                                                                       | note |
| ------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id                  | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                            |                                                                                                                                                                                                                                                                                                                               |      |
| business_partner_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_business_partners.roles |                                                                                                                                                                                                                                                                                                                               |      |
| role                | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                            | {"choices":[{"text":"CUSTOMER","value":"CUSTOMER"},{"text":"VENDOR","value":"VENDOR"},{"text":"EMPLOYEE","value":"EMPLOYEE"},{"text":"BANK","value":"BANK"},{"text":"GOVERNMENT","value":"GOVERNMENT"},{"text":"INTERNAL","value":"INTERNAL"},{"text":"SHAREHOLDER","value":"SHAREHOLDER"},{"text":"OTHER","value":"OTHER"}]} |      |
| is_default          | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                            |                                                                                                                                                                                                                                                                                                                               |      |
| is_active           | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                            |                                                                                                                                                                                                                                                                                                                               |      |
| note                | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                            |                                                                                                                                                                                                                                                                                                                               |      |
| created_at          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                            |                                                                                                                                                                                                                                                                                                                               |      |

### gw_business_partners

- Category: business
- Column count: 19
- Directus icon: groups
- Directus display template: {{code}} - {{name}}
- Directus note: Greenway external business partner master. Internal employees live in gw_employees.

| column       | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target | options                                                                                                 | note |
| ------------ | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | --------------- | ------------------------------------------------------------------------------------------------------- | ---- |
| id           | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                 |                                                                                                         |      |
| code         | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                 |                                                                                                         |      |
| name         | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                 |                                                                                                         |      |
| display_name | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| partner_kind | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                 | {"choices":[{"text":"ORGANIZATION","value":"ORGANIZATION"},{"text":"INDIVIDUAL","value":"INDIVIDUAL"}]} |      |
| tax_code     | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| phone        | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| email        | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| address      | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                 |                                                                                                         |      |
| country      | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| province     | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| district     | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| ward         | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                 |                                                                                                         |      |
| is_active    | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                 |                                                                                                         |      |
| note         | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                 |                                                                                                         |      |
| created_at   | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                 |                                                                                                         |      |
| updated_at   | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                 |                                                                                                         |      |
| created_by   | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users  |                                                                                                         |      |
| updated_by   | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users  |                                                                                                         |      |

### gw_cash_funds

- Category: business
- Column count: 10
- Directus icon: payments
- Directus display template: {{fund_code}} - {{fund_name}}
- Directus note: Greenway company cash funds.

| column                | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target      | options | note |
| --------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | -------------------- | ------- | ---- |
| id                    | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                      |         |      |
| fund_code             | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| fund_name             | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| currency              | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                      |         |      |
| accounting_account_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_chart_of_accounts |         |      |
| responsible_user_id   | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users       |         |      |
| is_active             | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                      |         |      |
| note                  | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                      |         |      |
| created_at            | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                      |         |      |
| updated_at            | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                      |         |      |

### gw_chart_of_accounts

- Category: business
- Column count: 16
- Directus icon: account_tree
- Directus display template: {{account_code}} - {{account_name}}
- Directus note: Greenway chart of accounts.

| column                | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                     | options                                                                                                                                                                                                                               | note |
| --------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id                    | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                     |                                                                                                                                                                                                                                       |      |
| account_code          | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| account_name          | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| account_type          | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                     | {"choices":[{"text":"ASSET","value":"ASSET"},{"text":"LIABILITY","value":"LIABILITY"},{"text":"EQUITY","value":"EQUITY"},{"text":"REVENUE","value":"REVENUE"},{"text":"EXPENSE","value":"EXPENSE"},{"text":"OTHER","value":"OTHER"}]} |      |
| normal_balance        | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                     | {"choices":[{"text":"DEBIT","value":"DEBIT"},{"text":"CREDIT","value":"CREDIT"}]}                                                                                                                                                     |      |
| parent_account_id     | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_chart_of_accounts.child_accounts |                                                                                                                                                                                                                                       |      |
| level                 | integer                  | int4        | YES      |         | input               |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_cash_account       | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_bank_account       | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_receivable_account | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_payable_account    | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_advance_account    | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| is_active             | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| note                  | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| created_at            | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                     |                                                                                                                                                                                                                                       |      |
| updated_at            | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                     |                                                                                                                                                                                                                                       |      |

### gw_company_bank_accounts

- Category: business
- Column count: 13
- Directus icon: account_balance_wallet
- Directus display template: {{bank_name}} - {{account_number}}
- Directus note: Greenway company bank accounts.

| column                | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target      | options | note |
| --------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | -------------------- | ------- | ---- |
| id                    | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                      |         |      |
| bank_account_code     | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| bank_name             | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| bank_branch           | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                      |         |      |
| account_number        | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| account_holder        | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                      |         |      |
| currency              | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                      |         |      |
| accounting_account_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_chart_of_accounts |         |      |
| responsible_user_id   | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users       |         |      |
| is_active             | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                      |         |      |
| note                  | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                      |         |      |
| created_at            | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                      |         |      |
| updated_at            | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                      |         |      |

### gw_departments

- Category: business
- Column count: 12
- Directus icon: corporate_fare
- Directus display template: {{department_code}} - {{department_name}}
- Directus note: Greenway internal departments and organizational units.

| column               | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                  | options | note |
| -------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | -------------------------------- | ------- | ---- |
| id                   | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                  |         |      |
| department_code      | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                  |         |      |
| department_name      | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                  |         |      |
| parent_department_id | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_departments.child_departments |         |      |
| manager_employee_id  | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_employees.managed_departments |         |      |
| description          | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                  |         |      |
| is_active            | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                                  |         |      |
| sort                 | integer                  | int4        | YES      |         | input               |         | false    | false    | false  |                                  |         |      |
| created_at           | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                  |         |      |
| updated_at           | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                  |         |      |
| created_by           | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                   |         |      |
| updated_by           | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                   |         |      |

### gw_employees

- Category: business
- Column count: 21
- Directus icon: groups
- Directus display template: {{employee_code}} - {{full_name}}
- Directus note: Greenway employee master for internal operations.

| column              | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target             | options                                                                                                                                                                   | note |
| ------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id                  | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                             |                                                                                                                                                                           |      |
| employee_code       | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                             |                                                                                                                                                                           |      |
| full_name           | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                             |                                                                                                                                                                           |      |
| email               | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| phone               | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| department_id       | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_departments.employees    |                                                                                                                                                                           |      |
| position_id         | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_positions.employees      |                                                                                                                                                                           |      |
| manager_employee_id | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_employees.direct_reports |                                                                                                                                                                           |      |
| directus_user_id    | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users              |                                                                                                                                                                           |      |
| business_partner_id | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_business_partners        |                                                                                                                                                                           |      |
| employment_status   | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                             | {"choices":[{"text":"active","value":"active"},{"text":"probation","value":"probation"},{"text":"suspended","value":"suspended"},{"text":"resigned","value":"resigned"}]} |      |
| hire_date           | date                     | date        | YES      |         | datetime            |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| resign_date         | date                     | date        | YES      |         | datetime            |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| signature_file_id   | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_files              |                                                                                                                                                                           |      |
| notes               | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| is_active           | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| sort                | integer                  | int4        | YES      |         | input               |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| created_at          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                             |                                                                                                                                                                           |      |
| updated_at          | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                             |                                                                                                                                                                           |      |
| created_by          | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users              |                                                                                                                                                                           |      |
| updated_by          | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users              |                                                                                                                                                                           |      |

### gw_opening_balances

- Category: business
- Column count: 12
- Directus icon: balance
- Directus display template:
- Directus note: Greenway opening balances.

| column                  | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target          | options | note |
| ----------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ------------------------ | ------- | ---- |
| id                      | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                          |         |      |
| fiscal_period           | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                          |         |      |
| balance_date            | date                     | date        | NO       |         | datetime            |         | true     | false    | false  |                          |         |      |
| account_id              | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_chart_of_accounts     |         |      |
| cash_fund_id            | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_cash_funds            |         |      |
| company_bank_account_id | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_company_bank_accounts |         |      |
| debit_amount            | numeric                  | numeric     | YES      |         | input               |         | false    | false    | false  |                          |         |      |
| credit_amount           | numeric                  | numeric     | YES      |         | input               |         | false    | false    | false  |                          |         |      |
| currency                | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                          |         |      |
| note                    | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                          |         |      |
| created_at              | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                          |         |      |
| created_by              | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users           |         |      |

### gw_payment_voucher_approval_logs

- Category: business
- Column count: 8
- Directus icon: fact_check
- Directus display template:
- Directus note: Greenway voucher approval logs.

| column             | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                   | options                                                                                                                                                                                    | note |
| ------------------ | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| id                 | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                   |                                                                                                                                                                                            |      |
| payment_voucher_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_payment_vouchers.approval_logs |                                                                                                                                                                                            |      |
| action             | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                   | {"choices":[{"text":"SUBMIT","value":"SUBMIT"},{"text":"APPROVE","value":"APPROVE"},{"text":"REJECT","value":"REJECT"},{"text":"POST","value":"POST"},{"text":"CANCEL","value":"CANCEL"}]} |      |
| action_by          | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                    |                                                                                                                                                                                            |      |
| action_at          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                   |                                                                                                                                                                                            |      |
| note               | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                   |                                                                                                                                                                                            |      |
| from_status        | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                            |      |
| to_status          | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                            |      |

### gw_payment_voucher_attachments

- Category: business
- Column count: 7
- Directus icon: attach_file
- Directus display template:
- Directus note: Greenway voucher attachments.

| column             | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                 | options                                                                                                                                                                                                                                                                 | note |
| ------------------ | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id                 | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                 |                                                                                                                                                                                                                                                                         |      |
| payment_voucher_id | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_payment_vouchers.attachments |                                                                                                                                                                                                                                                                         |      |
| file               | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | directus_files                  |                                                                                                                                                                                                                                                                         |      |
| attachment_type    | character varying        | varchar     | YES      |         | select-dropdown     |         | false    | false    | false  |                                 | {"choices":[{"text":"INVOICE","value":"INVOICE"},{"text":"RECEIPT","value":"RECEIPT"},{"text":"CONTRACT","value":"CONTRACT"},{"text":"PAYMENT_REQUEST","value":"PAYMENT_REQUEST"},{"text":"BANK_STATEMENT","value":"BANK_STATEMENT"},{"text":"OTHER","value":"OTHER"}]} |      |
| note               | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                 |                                                                                                                                                                                                                                                                         |      |
| uploaded_at        | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                 |                                                                                                                                                                                                                                                                         |      |
| uploaded_by        | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                  |                                                                                                                                                                                                                                                                         |      |

### gw_payment_vouchers

- Category: business
- Column count: 40
- Directus icon: receipt_long
- Directus display template: {{voucher_no}} - {{counterparty_name_snapshot}} - {{amount}}
- Directus note: Greenway payment vouchers.

| column                              | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target                   | options                                                                                                                                                                                                                                                         | note                                                                       |
| ----------------------------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| id                                  | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| voucher_no                          | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| voucher_channel                     | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                   | {"choices":[{"text":"CASH","value":"CASH"},{"text":"BANK","value":"BANK"}]}                                                                                                                                                                                     |                                                                            |
| voucher_direction                   | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                   | {"choices":[{"text":"IN","value":"IN"},{"text":"OUT","value":"OUT"}]}                                                                                                                                                                                           |                                                                            |
| voucher_type                        | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                   | {"choices":[{"text":"CASH_RECEIPT","value":"CASH_RECEIPT"},{"text":"CASH_PAYMENT","value":"CASH_PAYMENT"},{"text":"BANK_RECEIPT","value":"BANK_RECEIPT"},{"text":"BANK_PAYMENT","value":"BANK_PAYMENT"}]}                                                       |                                                                            |
| document_date                       | date                     | date        | NO       |         | datetime            |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| posting_date                        | date                     | date        | NO       |         | datetime            |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| counterparty_id                     | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_business_partners              |                                                                                                                                                                                                                                                                 | External counterparty only.                                                |
| counterparty_role                   | character varying        | varchar     | YES      |         | select-dropdown     |         | false    | false    | false  |                                   | {"choices":[{"text":"CUSTOMER","value":"CUSTOMER"},{"text":"VENDOR","value":"VENDOR"},{"text":"BANK","value":"BANK"},{"text":"GOVERNMENT","value":"GOVERNMENT"},{"text":"SHAREHOLDER","value":"SHAREHOLDER"},{"text":"OTHER","value":"OTHER"}]}                 | External counterparty role snapshot.                                       |
| actual_person_name                  | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| actual_person_id_no                 | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| actual_person_phone                 | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| description                         | text                     | text        | NO       |         | input-multiline     |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| debit_account_id                    | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_chart_of_accounts              |                                                                                                                                                                                                                                                                 |                                                                            |
| credit_account_id                   | uuid                     | uuid        | NO       | m2o     | select-dropdown-m2o |         | true     | false    | false  | gw_chart_of_accounts              |                                                                                                                                                                                                                                                                 |                                                                            |
| cash_fund_id                        | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_cash_funds                     |                                                                                                                                                                                                                                                                 |                                                                            |
| company_bank_account_id             | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_company_bank_accounts          |                                                                                                                                                                                                                                                                 |                                                                            |
| beneficiary_bank_account_id         | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_business_partner_bank_accounts |                                                                                                                                                                                                                                                                 |                                                                            |
| amount                              | numeric                  | numeric     | NO       |         | input               |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| currency                            | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| amount_in_words                     | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| status                              | character varying        | varchar     | NO       |         | select-dropdown     |         | true     | false    | false  |                                   | {"choices":[{"text":"DRAFT","value":"DRAFT"},{"text":"PENDING_APPROVAL","value":"PENDING_APPROVAL"},{"text":"APPROVED","value":"APPROVED"},{"text":"POSTED","value":"POSTED"},{"text":"REJECTED","value":"REJECTED"},{"text":"CANCELLED","value":"CANCELLED"}]} |                                                                            |
| counterparty_name_snapshot          | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Copied from gw_employees or gw_business_partners at voucher creation time. |
| counterparty_tax_code_snapshot      | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Tax code snapshot for external counterparties.                             |
| counterparty_address_snapshot       | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Address snapshot copied at voucher creation time.                          |
| created_by                          | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                    |                                                                                                                                                                                                                                                                 |                                                                            |
| approved_by                         | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users                    |                                                                                                                                                                                                                                                                 |                                                                            |
| approved_at                         | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| posted_at                           | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| cancelled_at                        | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| cancel_reason                       | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| created_at                          | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| updated_at                          | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 |                                                                            |
| counterparty_source                 | character varying        | varchar     | NO       |         | select-radio        |         | true     | false    | false  |                                   | {"choices":[{"text":"INTERNAL","value":"INTERNAL"},{"text":"EXTERNAL","value":"EXTERNAL"}]}                                                                                                                                                                     | INTERNAL selects gw_employees. EXTERNAL selects gw_business_partners.      |
| employee_id                         | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_employees                      |                                                                                                                                                                                                                                                                 | Internal counterparty only.                                                |
| counterparty_phone_snapshot         | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Phone snapshot copied at voucher creation time.                            |
| counterparty_identity_no_snapshot   | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Identity document snapshot for internal counterparties or individuals.     |
| beneficiary_bank_name_snapshot      | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Beneficiary bank name snapshot.                                            |
| beneficiary_bank_account_snapshot   | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Beneficiary bank account number snapshot.                                  |
| beneficiary_account_holder_snapshot | character varying        | varchar     | YES      |         | input               |         | false    | false    | false  |                                   |                                                                                                                                                                                                                                                                 | Beneficiary account holder snapshot.                                       |

### gw_positions

- Category: business
- Column count: 13
- Directus icon: badge
- Directus display template: {{position_code}} - {{position_name}}
- Directus note: Greenway positions and business roles.

| column           | data_type                | udt_name    | nullable | special | interface           | display | required | readonly | hidden | relation_target          | options                                                                                                                                                                                                                                                                                                                                                                | note |
| ---------------- | ------------------------ | ----------- | -------- | ------- | ------------------- | ------- | -------- | -------- | ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id               | uuid                     | uuid        | NO       | uuid    | input               |         | false    | true     | true   |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| position_code    | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| position_name    | character varying        | varchar     | NO       |         | input               |         | true     | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| department_group | character varying        | varchar     | YES      |         | select-dropdown     |         | false    | false    | false  |                          | {"choices":[{"text":"management","value":"management"},{"text":"accounting","value":"accounting"},{"text":"hr_admin","value":"hr_admin"},{"text":"operations","value":"operations"},{"text":"workshop","value":"workshop"},{"text":"sales","value":"sales"},{"text":"warehouse","value":"warehouse"},{"text":"it","value":"it"},{"text":"general","value":"general"}]} |      |
| approval_level   | integer                  | int4        | YES      |         | input               |         | false    | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| description      | text                     | text        | YES      |         | input-multiline     |         | false    | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| is_active        | boolean                  | bool        | NO       |         | boolean             |         | false    | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| sort             | integer                  | int4        | YES      |         | input               |         | false    | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| created_at       | timestamp with time zone | timestamptz | NO       |         | datetime            |         | true     | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| updated_at       | timestamp with time zone | timestamptz | YES      |         | datetime            |         | false    | false    | false  |                          |                                                                                                                                                                                                                                                                                                                                                                        |      |
| created_by       | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users           |                                                                                                                                                                                                                                                                                                                                                                        |      |
| updated_by       | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | directus_users           |                                                                                                                                                                                                                                                                                                                                                                        |      |
| department_id    | uuid                     | uuid        | YES      | m2o     | select-dropdown-m2o |         | false    | false    | false  | gw_departments.positions |                                                                                                                                                                                                                                                                                                                                                                        |      |

### gw_voucher_numbering_configs

- Category: business
- Column count: 10
- Directus icon: pin
- Directus display template:
- Directus note: Greenway voucher numbering configs.

| column           | data_type                | udt_name    | nullable | special | interface       | display | required | readonly | hidden | relation_target | options                                                                                                                                                                                                   | note |
| ---------------- | ------------------------ | ----------- | -------- | ------- | --------------- | ------- | -------- | -------- | ------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| id               | uuid                     | uuid        | NO       | uuid    | input           |         | false    | true     | true   |                 |                                                                                                                                                                                                           |      |
| voucher_type     | character varying        | varchar     | NO       |         | select-dropdown |         | true     | false    | false  |                 | {"choices":[{"text":"CASH_RECEIPT","value":"CASH_RECEIPT"},{"text":"CASH_PAYMENT","value":"CASH_PAYMENT"},{"text":"BANK_RECEIPT","value":"BANK_RECEIPT"},{"text":"BANK_PAYMENT","value":"BANK_PAYMENT"}]} |      |
| prefix           | character varying        | varchar     | NO       |         | input           |         | true     | false    | false  |                 |                                                                                                                                                                                                           |      |
| date_pattern     | character varying        | varchar     | YES      |         | input           |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
| current_sequence | integer                  | int4        | YES      |         | input           |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
| padding_length   | integer                  | int4        | YES      |         | input           |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
| reset_period     | character varying        | varchar     | NO       |         | select-dropdown |         | true     | false    | false  |                 | {"choices":[{"text":"NONE","value":"NONE"},{"text":"YEARLY","value":"YEARLY"},{"text":"MONTHLY","value":"MONTHLY"}]}                                                                                      |      |
| is_active        | boolean                  | bool        | NO       |         | boolean         |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
| note             | text                     | text        | YES      |         | input-multiline |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
| updated_at       | timestamp with time zone | timestamptz | YES      |         | datetime        |         | false    | false    | false  |                 |                                                                                                                                                                                                           |      |
