const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class Database {
  constructor() {
    const dbPath = process.env.DB_PATH || "./database.sqlite";
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
      } else {
        console.log("Connected to SQLite database");
        this.initialize();
      }
    });
  }

  initialize() {
    this.db.serialize(() => {
      // Users
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT,
          phone TEXT,
          role TEXT DEFAULT 'user',
          company_id INTEGER,
          adr INTEGER DEFAULT 0,
          can_fill_in INTEGER DEFAULT 0,
          fill_in_company_id INTEGER,
          mega_kast TEXT DEFAULT 'only_mega',
          ritnumber TEXT,
          is_blocked INTEGER DEFAULT 0,
          note TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
          FOREIGN KEY (fill_in_company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(`PRAGMA table_info(users)`, [], (err, columns) => {
              if (!err && columns) {
                const ensure = (name, sql) => {
                  if (!columns.some((c) => c.name === name)) {
                    this.db.run(sql);
                  }
                };
                ensure(
                  "adr",
                  "ALTER TABLE users ADD COLUMN adr INTEGER DEFAULT 0"
                );
                ensure(
                  "can_fill_in",
                  "ALTER TABLE users ADD COLUMN can_fill_in INTEGER DEFAULT 0"
                );
                ensure(
                  "fill_in_company_id",
                  "ALTER TABLE users ADD COLUMN fill_in_company_id INTEGER"
                );
                ensure(
                  "mega_kast",
                  "ALTER TABLE users ADD COLUMN mega_kast TEXT DEFAULT 'only_mega'"
                );
                ensure(
                  "ritnumber",
                  "ALTER TABLE users ADD COLUMN ritnumber TEXT"
                );
                ensure(
                  "is_blocked",
                  "ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0"
                );
                ensure("note", "ALTER TABLE users ADD COLUMN note TEXT");
                // MFA columns
                ensure(
                  "mfa_enabled",
                  "ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0"
                );
                ensure(
                  "mfa_secret",
                  "ALTER TABLE users ADD COLUMN mfa_secret TEXT"
                );
                ensure(
                  "mfa_backup_codes",
                  "ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT"
                );
                ensure(
                  "mfa_skip_count",
                  "ALTER TABLE users ADD COLUMN mfa_skip_count INTEGER DEFAULT 0"
                );
                ensure(
                  "mfa_prompted_at",
                  "ALTER TABLE users ADD COLUMN mfa_prompted_at DATETIME"
                );
              }
            });
          }
        }
      );

      // Timesheets
      this.db.run(`
        CREATE TABLE IF NOT EXISTS timesheets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          start_km REAL NOT NULL,
          end_km REAL NOT NULL,
          pause_time TEXT NOT NULL,
          total_hours REAL,
          total_km REAL,
          ritnumber TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Ensure ritnumber column exists in timesheets table
      this.db.all(`PRAGMA table_info(timesheets)`, [], (err, columns) => {
        if (!err && columns) {
          const hasRitnumber = columns.some((c) => c.name === "ritnumber");
          const hasCompanyId = columns.some((c) => c.name === "company_id");
          if (!hasRitnumber) {
            this.db.run(
              `ALTER TABLE timesheets ADD COLUMN ritnumber TEXT`,
              (err) => {
                if (err) {
                  console.error(
                    "Error adding ritnumber column to timesheets:",
                    err
                  );
                } else {
                  console.log("✓ Added ritnumber column to timesheets");
                }
              }
            );
          }
          if (!hasCompanyId) {
            this.db.run(
              `ALTER TABLE timesheets ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
              (err) => {
                if (err) {
                  console.error(
                    "Error adding company_id column to timesheets:",
                    err
                  );
                } else {
                  console.log("✓ Added company_id column to timesheets");
                }
              }
            );
          }
        }
      });
      // Seed admin translations (actions, fleet, planning, leave, MFA)
      const adminDefaults = [
        ["admin", "save", "en", "Save"],
        ["admin", "save", "nl", "Opslaan"],
        ["admin", "save", "de", "Speichern"],
        ["admin", "saving", "en", "Saving..."],
        ["admin", "saving", "nl", "Opslaan..."],
        ["admin", "saving", "de", "Speichern..."],
        ["admin", "cancel", "en", "Cancel"],
        ["admin", "cancel", "nl", "Annuleren"],
        ["admin", "cancel", "de", "Abbrechen"],
        ["admin", "delete", "en", "Delete"],
        ["admin", "delete", "nl", "Verwijderen"],
        ["admin", "delete", "de", "Löschen"],
        ["admin", "deleting", "en", "Deleting..."],
        ["admin", "deleting", "nl", "Verwijderen..."],
        ["admin", "deleting", "de", "Löschen..."],
        ["admin", "edit", "en", "Edit"],
        ["admin", "edit", "nl", "Bewerken"],
        ["admin", "edit", "de", "Bearbeiten"],
        ["admin", "add", "en", "Add"],
        ["admin", "add", "nl", "Toevoegen"],
        ["admin", "add", "de", "Hinzufügen"],
        ["admin", "loading", "en", "Loading..."],
        ["admin", "loading", "nl", "Laden..."],
        ["admin", "loading", "de", "Laden..."],
        ["admin", "no_company", "en", "No company"],
        ["admin", "no_company", "nl", "Geen bedrijf"],
        ["admin", "no_company", "de", "Keine Firma"],
        ["admin", "select_company", "en", "Select company"],
        ["admin", "select_company", "nl", "Selecteer bedrijf"],
        ["admin", "select_company", "de", "Firma auswählen"],
        [
          "admin",
          "confirm_delete",
          "en",
          "Are you sure you want to delete? This cannot be undone.",
        ],
        [
          "admin",
          "confirm_delete",
          "nl",
          "Weet je zeker dat je dit wilt verwijderen? Dit kan niet ongedaan gemaakt worden.",
        ],
        [
          "admin",
          "confirm_delete",
          "de",
          "Möchten Sie wirklich löschen? Dies kann nicht rückgängig gemacht werden.",
        ],

        // Fleet management
        ["admin", "fleet.no_vehicles", "en", "No vehicles"],
        ["admin", "fleet.no_vehicles", "nl", "Geen voertuigen"],
        ["admin", "fleet.no_vehicles", "de", "Keine Fahrzeuge"],
        ["admin", "fleet.add_first", "en", "Add a vehicle first."],
        ["admin", "fleet.add_first", "nl", "Voeg eerst een voertuig toe."],
        [
          "admin",
          "fleet.add_first",
          "de",
          "Fügen Sie zuerst ein Fahrzeug hinzu.",
        ],
        ["admin", "fleet.no_maintenance", "en", "No maintenance records"],
        ["admin", "fleet.no_maintenance", "nl", "Geen onderhoud geregistreerd"],
        ["admin", "fleet.no_maintenance", "de", "Keine Wartungseinträge"],
        ["admin", "fleet.select_vehicle", "en", "Select a vehicle"],
        ["admin", "fleet.select_vehicle", "nl", "Selecteer een voertuig"],
        ["admin", "fleet.select_vehicle", "de", "Wählen Sie ein Fahrzeug"],
        ["admin", "fleet.new_vehicle", "en", "New vehicle"],
        ["admin", "fleet.new_vehicle", "nl", "Nieuw voertuig"],
        ["admin", "fleet.new_vehicle", "de", "Neues Fahrzeug"],
        ["admin", "fleet.edit_vehicle", "en", "Edit vehicle"],
        ["admin", "fleet.edit_vehicle", "nl", "Bewerk voertuig"],
        ["admin", "fleet.edit_vehicle", "de", "Fahrzeug bearbeiten"],
        ["admin", "fleet.delete_maintenance", "en", "Delete maintenance"],
        ["admin", "fleet.delete_maintenance", "nl", "Onderhoud verwijderen"],
        ["admin", "fleet.delete_maintenance", "de", "Wartung löschen"],
        ["admin", "fleet.new_maintenance", "en", "New maintenance"],
        ["admin", "fleet.new_maintenance", "nl", "Nieuw onderhoud"],
        ["admin", "fleet.new_maintenance", "de", "Neue Wartung"],
        ["admin", "fleet.edit_maintenance", "en", "Edit maintenance"],
        ["admin", "fleet.edit_maintenance", "nl", "Bewerk onderhoud"],
        ["admin", "fleet.edit_maintenance", "de", "Wartung bearbeiten"],
        ["admin", "fleet.license_required", "en", "License plate is required"],
        ["admin", "fleet.license_required", "nl", "Kenteken is verplicht"],
        [
          "admin",
          "fleet.license_required",
          "de",
          "Kennzeichen ist erforderlich",
        ],
        ["admin", "fleet.date_required", "en", "Date is required"],
        ["admin", "fleet.date_required", "nl", "Datum is verplicht"],
        ["admin", "fleet.date_required", "de", "Datum ist erforderlich"],

        // Planning
        ["admin", "planning.no_planning", "en", "No planning for this week"],
        ["admin", "planning.no_planning", "nl", "Geen planning voor deze week"],
        [
          "admin",
          "planning.no_planning",
          "de",
          "Keine Planung für diese Woche",
        ],
        ["admin", "planning.new_planning", "en", "New planning"],
        ["admin", "planning.new_planning", "nl", "Nieuwe planning"],
        ["admin", "planning.new_planning", "de", "Neue Planung"],
        ["admin", "planning.edit_planning", "en", "Edit planning"],
        ["admin", "planning.edit_planning", "nl", "Bewerk planning"],
        ["admin", "planning.edit_planning", "de", "Planung bearbeiten"],
        [
          "admin",
          "planning.select_company_first",
          "en",
          "Select company first",
        ],
        [
          "admin",
          "planning.select_company_first",
          "nl",
          "Selecteer eerst een bedrijf",
        ],
        [
          "admin",
          "planning.select_company_first",
          "de",
          "Wählen Sie zuerst eine Firma",
        ],
        ["admin", "planning.week_number", "en", "Week number"],
        ["admin", "planning.week_number", "nl", "Weeknummer"],
        ["admin", "planning.week_number", "de", "Wochennummer"],
        ["admin", "planning.route_number", "en", "Route number"],
        ["admin", "planning.route_number", "nl", "Route nummer"],
        ["admin", "planning.route_number", "de", "Routennummer"],
        ["admin", "planning.driver", "en", "Driver"],
        ["admin", "planning.driver", "nl", "Chauffeur"],
        ["admin", "planning.driver", "de", "Fahrer"],
        ["admin", "planning.notes", "en", "Notes"],
        ["admin", "planning.notes", "nl", "Notities"],
        ["admin", "planning.notes", "de", "Notizen"],
        ["admin", "planning.phone", "en", "Phone"],
        ["admin", "planning.phone", "nl", "Telefoon"],
        ["admin", "planning.phone", "de", "Telefon"],
        ["admin", "planning.truck", "en", "Truck"],
        ["admin", "planning.truck", "nl", "Truck"],
        ["admin", "planning.truck", "de", "LKW"],
        ["admin", "planning.license_plate", "en", "License plate"],
        ["admin", "planning.license_plate", "nl", "Kenteken"],
        ["admin", "planning.license_plate", "de", "Kennzeichen"],
        ["admin", "planning.day", "en", "Day"],
        ["admin", "planning.day", "nl", "Dag"],
        ["admin", "planning.day", "de", "Tag"],
        [
          "admin",
          "planning.confirm_clear",
          "en",
          "Clear planning for this company in this week?",
        ],
        [
          "admin",
          "planning.confirm_clear",
          "nl",
          "Planning voor dit bedrijf in deze week wissen?",
        ],
        [
          "admin",
          "planning.confirm_clear",
          "de",
          "Planung für diese Firma in dieser Woche löschen?",
        ],
        ["admin", "planning.cleared", "en", "Planning cleared"],
        ["admin", "planning.cleared", "nl", "Planning gewist"],
        ["admin", "planning.cleared", "de", "Planung gelöscht"],
        ["admin", "planning.driver_updated", "en", "Driver updated"],
        ["admin", "planning.driver_updated", "nl", "Chauffeur bijgewerkt"],
        ["admin", "planning.driver_updated", "de", "Fahrer aktualisiert"],
        ["admin", "planning.update_failed", "en", "Update failed"],
        ["admin", "planning.update_failed", "nl", "Update mislukt"],
        [
          "admin",
          "planning.update_failed",
          "de",
          "Aktualisierung fehlgeschlagen",
        ],
        ["admin", "planning.delete_failed", "en", "Delete failed"],
        ["admin", "planning.delete_failed", "nl", "Verwijderen mislukt"],
        ["admin", "planning.delete_failed", "de", "Löschen fehlgeschlagen"],
        ["admin", "planning.generate_failed", "en", "Generate failed"],
        ["admin", "planning.generate_failed", "nl", "Genereren mislukt"],
        [
          "admin",
          "planning.generate_failed",
          "de",
          "Generierung fehlgeschlagen",
        ],
        ["admin", "planning.clear_failed", "en", "Clear failed"],
        ["admin", "planning.clear_failed", "nl", "Wissen mislukt"],
        ["admin", "planning.clear_failed", "de", "Löschen fehlgeschlagen"],
        ["admin", "planning.export_failed", "en", "Export failed"],
        ["admin", "planning.export_failed", "nl", "Export mislukt"],
        ["admin", "planning.export_failed", "de", "Export fehlgeschlagen"],
        ["admin", "planning.email_sent", "en", "Email sent"],
        ["admin", "planning.email_sent", "nl", "E-mail verzonden"],
        ["admin", "planning.email_sent", "de", "E-Mail gesendet"],
        ["admin", "planning.select_driver", "en", "Select driver"],
        ["admin", "planning.select_driver", "nl", "Selecteer chauffeur"],
        ["admin", "planning.select_driver", "de", "Fahrer auswählen"],
        ["admin", "planning.no_drivers", "en", "No drivers"],
        ["admin", "planning.no_drivers", "nl", "Geen chauffeurs"],
        ["admin", "planning.no_drivers", "de", "Keine Fahrer"],
        [
          "admin",
          "planning.select_min_fields",
          "en",
          "Select company, driver and enter route",
        ],
        [
          "admin",
          "planning.select_min_fields",
          "nl",
          "Selecteer bedrijf, chauffeur en vul route in",
        ],
        [
          "admin",
          "planning.select_min_fields",
          "de",
          "Wählen Sie Firma, Fahrer und geben Sie Route ein",
        ],

        // Leave management
        ["admin", "leave.no_requests", "en", "No leave requests"],
        ["admin", "leave.no_requests", "nl", "Geen verlofaanvragen"],
        ["admin", "leave.no_requests", "de", "Keine Urlaubsanträge"],
        ["admin", "leave.user", "en", "User"],
        ["admin", "leave.user", "nl", "Gebruiker"],
        ["admin", "leave.user", "de", "Benutzer"],
        ["admin", "leave.balance_header", "en", "User Leave Balance"],
        ["admin", "leave.balance_header", "nl", "Gebruikers Verlofsaldo"],
        ["admin", "leave.balance_header", "de", "Benutzer Urlaubssaldo"],
        ["admin", "leave.requests_header", "en", "Leave Requests"],
        ["admin", "leave.requests_header", "nl", "Verlofaanvragen"],
        ["admin", "leave.requests_header", "de", "Urlaubsanträge"],

        // Days of the week (short)
        ["admin", "day.mon", "en", "Mon"],
        ["admin", "day.mon", "nl", "Ma"],
        ["admin", "day.mon", "de", "Mo"],
        ["admin", "day.tue", "en", "Tue"],
        ["admin", "day.tue", "nl", "Di"],
        ["admin", "day.tue", "de", "Di"],
        ["admin", "day.wed", "en", "Wed"],
        ["admin", "day.wed", "nl", "Wo"],
        ["admin", "day.wed", "de", "Mi"],
        ["admin", "day.thu", "en", "Thu"],
        ["admin", "day.thu", "nl", "Do"],
        ["admin", "day.thu", "de", "Do"],
        ["admin", "day.fri", "en", "Fri"],
        ["admin", "day.fri", "nl", "Vr"],
        ["admin", "day.fri", "de", "Fr"],

        // MFA
        [
          "admin",
          "mfa.reset_confirm",
          "en",
          "Confirm with your own MFA code to reset this user's MFA",
        ],
        [
          "admin",
          "mfa.reset_confirm",
          "nl",
          "Bevestig met je eigen MFA code om de MFA van deze gebruiker te resetten",
        ],
        [
          "admin",
          "mfa.reset_confirm",
          "de",
          "Bestätigen Sie mit Ihrem eigenen MFA-Code, um die MFA dieses Benutzers zurückzusetzen",
        ],
        ["admin", "mfa.admin_code", "en", "Admin MFA code"],
        ["admin", "mfa.admin_code", "nl", "Admin MFA code"],
        ["admin", "mfa.admin_code", "de", "Admin MFA-Code"],
        [
          "admin",
          "mfa.reset_success",
          "en",
          "MFA reset. User must setup MFA again at next login.",
        ],
        [
          "admin",
          "mfa.reset_success",
          "nl",
          "MFA is gereset. Gebruiker moet opnieuw MFA instellen bij volgende login.",
        ],
        [
          "admin",
          "mfa.reset_success",
          "de",
          "MFA zurückgesetzt. Benutzer muss MFA beim nächsten Login erneut einrichten.",
        ],
        ["admin", "mfa.invalid_code", "en", "Enter a valid 6-digit code"],
        [
          "admin",
          "mfa.invalid_code",
          "nl",
          "Voer een geldige 6-cijferige code in",
        ],
        [
          "admin",
          "mfa.invalid_code",
          "de",
          "Geben Sie einen gültigen 6-stelligen Code ein",
        ],
      ];

      adminDefaults.forEach((t) => {
        // Use INSERT OR IGNORE to avoid UNIQUE constraint errors
        this.db.run(
          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`,
          t,
          (err) => {
            if (err && !err.message.includes("UNIQUE constraint failed"))
              console.error("Error inserting admin translation", err.message);
          }
        );
      });

      // Ensure a few UI labels exist for all locales (in case translations table was not empty earlier)
      const uiDefaults = [
        ["ui", "menu.page_key", "en", "Page Key"],
        ["ui", "menu.page_key", "nl", "Pagina sleutel"],
        ["ui", "menu.page_key", "de", "Seiten-Schlüssel"],
        ["ui", "menu.label", "en", "Label"],
        ["ui", "menu.label", "nl", "Label"],
        ["ui", "menu.label", "de", "Beschriftung"],
        ["ui", "menu.visible", "en", "Visible"],
        ["ui", "menu.visible", "nl", "Zichtbaar"],
        ["ui", "menu.visible", "de", "Sichtbar"],

        // Additional UI labels used across the app
        ["ui", "brand.title", "en", "Timesheet System"],
        ["ui", "brand.title", "nl", "Timesheet Systeem"],
        ["ui", "brand.title", "de", "Zeiterfassungssystem"],

        ["ui", "welcome", "en", "Welcome,"],
        ["ui", "welcome", "nl", "Welkom,"],
        ["ui", "welcome", "de", "Willkommen,"],

        ["ui", "change_password", "en", "Change Password"],
        ["ui", "change_password", "nl", "Wachtwoord wijzigen"],
        ["ui", "change_password", "de", "Passwort ändern"],

        ["ui", "language", "en", "Language"],
        ["ui", "language", "nl", "Taal"],
        ["ui", "language", "de", "Sprache"],

        ["ui", "logout", "en", "Logout"],
        ["ui", "logout", "nl", "Uitloggen"],
        ["ui", "logout", "de", "Abmelden"],

        ["ui", "save", "en", "Save"],
        ["ui", "save", "nl", "Opslaan"],
        ["ui", "save", "de", "Speichern"],

        ["ui", "add", "en", "Add"],
        ["ui", "add", "nl", "Toevoegen"],
        ["ui", "add", "de", "Hinzufügen"],

        ["ui", "yes", "en", "Yes"],
        ["ui", "yes", "nl", "Ja"],
        ["ui", "yes", "de", "Ja"],

        ["ui", "no", "en", "No"],
        ["ui", "no", "nl", "Nee"],
        ["ui", "no", "de", "Nein"],

        ["ui", "namespace", "en", "Namespace"],
        ["ui", "namespace", "nl", "Namespace"],
        ["ui", "namespace", "de", "Namensraum"],

        ["ui", "locale", "en", "Locale"],
        ["ui", "locale", "nl", "Taal"],
        ["ui", "locale", "de", "Sprache"],

        ["ui", "load", "en", "Load"],
        ["ui", "load", "nl", "Laden"],
        ["ui", "load", "de", "Laden"],

        ["ui", "load_translations", "en", "Load Translations"],
        ["ui", "load_translations", "nl", "Vertalingen laden"],
        ["ui", "load_translations", "de", "Übersetzungen laden"],

        ["ui", "save_translations", "en", "Save Translations"],
        ["ui", "save_translations", "nl", "Vertalingen opslaan"],
        ["ui", "save_translations", "de", "Übersetzungen speichern"],

        ["ui", "export_template_csv", "en", "Export Template (CSV)"],
        ["ui", "export_template_csv", "nl", "Template exporteren (CSV)"],
        ["ui", "export_template_csv", "de", "Vorlage exportieren (CSV)"],

        ["ui", "export_json", "en", "Export JSON"],
        ["ui", "export_json", "nl", "JSON exporteren"],
        ["ui", "export_json", "de", "JSON exportieren"],

        ["ui", "export_csv", "en", "Export CSV"],
        ["ui", "export_csv", "nl", "CSV exporteren"],
        ["ui", "export_csv", "de", "CSV exportieren"],

        ["ui", "import", "en", "Import"],
        ["ui", "import", "nl", "Importeren"],
        ["ui", "import", "de", "Importieren"],

        ["ui", "key", "en", "Key"],
        ["ui", "key", "nl", "Sleutel"],
        ["ui", "key", "de", "Schlüssel"],

        ["ui", "text", "en", "Text"],
        ["ui", "text", "nl", "Tekst"],
        ["ui", "text", "de", "Text"],

        ["ui", "actions", "en", "Actions"],
        ["ui", "actions", "nl", "Acties"],
        ["ui", "actions", "de", "Aktionen"],

        ["ui", "delete", "en", "Delete"],
        ["ui", "delete", "nl", "Verwijderen"],
        ["ui", "delete", "de", "Löschen"],

        // Generic actions
        ["ui", "edit", "en", "Edit"],
        ["ui", "edit", "nl", "Bewerken"],
        ["ui", "edit", "de", "Bearbeiten"],

        ["ui", "update", "en", "Update"],
        ["ui", "update", "nl", "Bijwerken"],
        ["ui", "update", "de", "Aktualisieren"],

        ["ui", "cancel", "en", "Cancel"],
        ["ui", "cancel", "nl", "Annuleren"],
        ["ui", "cancel", "de", "Abbrechen"],

        ["ui", "withdraw", "en", "Withdraw"],
        ["ui", "withdraw", "nl", "Intrekken"],
        ["ui", "withdraw", "de", "Zurückziehen"],

        // Leave hints
        ["ui", "leave_edit_hint", "en", 'Adjust the data and click "Update"'],
        [
          "ui",
          "leave_edit_hint",
          "nl",
          'Pas de gegevens aan en klik op "Bijwerken"',
        ],
        [
          "ui",
          "leave_edit_hint",
          "de",
          'Passen Sie die Daten an und klicken Sie auf "Aktualisieren"',
        ],

        // Invoice flows
        ["ui", "invoice.load_error", "en", "Error loading invoice data"],
        [
          "ui",
          "invoice.load_error",
          "nl",
          "Fout bij laden van factuurgegevens",
        ],
        [
          "ui",
          "invoice.load_error",
          "de",
          "Fehler beim Laden der Rechnungsdaten",
        ],

        [
          "ui",
          "invoice.template_name_required",
          "en",
          "Template name is required",
        ],
        [
          "ui",
          "invoice.template_name_required",
          "nl",
          "Template naam is verplicht",
        ],
        [
          "ui",
          "invoice.template_name_required",
          "de",
          "Vorlagenname ist erforderlich",
        ],

        ["ui", "invoice.template_created", "en", "Template created"],
        [
          "ui",
          "invoice.template_created",
          "nl",
          "Template succesvol aangemaakt",
        ],
        ["ui", "invoice.template_created", "de", "Vorlage erstellt"],

        [
          "ui",
          "invoice.template_create_failed",
          "en",
          "Error creating template",
        ],
        [
          "ui",
          "invoice.template_create_failed",
          "nl",
          "Fout bij aanmaken template",
        ],
        [
          "ui",
          "invoice.template_create_failed",
          "de",
          "Fehler beim Erstellen der Vorlage",
        ],

        ["ui", "invoice.template_load_failed", "en", "Error loading template"],
        ["ui", "invoice.template_load_failed", "nl", "Fout bij laden template"],
        [
          "ui",
          "invoice.template_load_failed",
          "de",
          "Fehler beim Laden der Vorlage",
        ],

        ["ui", "invoice.template_updated", "en", "Template settings updated"],
        [
          "ui",
          "invoice.template_updated",
          "nl",
          "Template instellingen bijgewerkt",
        ],
        [
          "ui",
          "invoice.template_updated",
          "de",
          "Vorlageneinstellungen aktualisiert",
        ],

        [
          "ui",
          "invoice.template_update_failed",
          "en",
          "Error updating template",
        ],
        [
          "ui",
          "invoice.template_update_failed",
          "nl",
          "Fout bij bijwerken template",
        ],
        [
          "ui",
          "invoice.template_update_failed",
          "de",
          "Fehler beim Aktualisieren der Vorlage",
        ],

        ["ui", "invoice.text_required", "en", "Text content is required"],
        ["ui", "invoice.text_required", "nl", "Tekst inhoud is verplicht"],
        ["ui", "invoice.text_required", "de", "Textinhalt ist erforderlich"],

        ["ui", "invoice.select_image", "en", "Select an image"],
        ["ui", "invoice.select_image", "nl", "Selecteer een afbeelding"],
        ["ui", "invoice.select_image", "de", "Bild auswählen"],

        ["ui", "invoice.element_added", "en", "Element added"],
        ["ui", "invoice.element_added", "nl", "Element toegevoegd"],
        ["ui", "invoice.element_added", "de", "Element hinzugefügt"],

        ["ui", "invoice.element_add_failed", "en", "Error adding element"],
        [
          "ui",
          "invoice.element_add_failed",
          "nl",
          "Fout bij toevoegen element",
        ],
        [
          "ui",
          "invoice.element_add_failed",
          "de",
          "Fehler beim Hinzufügen des Elements",
        ],

        ["ui", "invoice.no_elements", "en", "No elements added yet"],
        ["ui", "invoice.no_elements", "nl", "Nog geen elementen toegevoegd"],
        ["ui", "invoice.no_elements", "de", "Noch keine Elemente hinzugefügt"],

        ["ui", "invoice.element_not_found", "en", "Element not found"],
        ["ui", "invoice.element_not_found", "nl", "Element niet gevonden"],
        ["ui", "invoice.element_not_found", "de", "Element nicht gefunden"],

        ["ui", "invoice.element_updated", "en", "Element updated"],
        ["ui", "invoice.element_updated", "nl", "Element bijgewerkt"],
        ["ui", "invoice.element_updated", "de", "Element aktualisiert"],

        ["ui", "invoice.element_update_failed", "en", "Error updating element"],
        [
          "ui",
          "invoice.element_update_failed",
          "nl",
          "Fout bij bijwerken element",
        ],
        [
          "ui",
          "invoice.element_update_failed",
          "de",
          "Fehler beim Aktualisieren des Elements",
        ],

        ["ui", "invoice.element_deleted", "en", "Element deleted"],
        ["ui", "invoice.element_deleted", "nl", "Element verwijderd"],
        ["ui", "invoice.element_deleted", "de", "Element gelöscht"],

        ["ui", "invoice.element_delete_failed", "en", "Error deleting element"],
        [
          "ui",
          "invoice.element_delete_failed",
          "nl",
          "Fout bij verwijderen element",
        ],
        [
          "ui",
          "invoice.element_delete_failed",
          "de",
          "Fehler beim Löschen des Elements",
        ],

        ["ui", "invoice.template_not_found", "en", "Template not found"],
        ["ui", "invoice.template_not_found", "nl", "Template niet gevonden"],
        ["ui", "invoice.template_not_found", "de", "Vorlage nicht gefunden"],

        [
          "ui",
          "invoice.add_at_least_one_line",
          "en",
          "Add at least one invoice line",
        ],
        [
          "ui",
          "invoice.add_at_least_one_line",
          "nl",
          "Voeg minimaal één factuurregel toe",
        ],
        [
          "ui",
          "invoice.add_at_least_one_line",
          "de",
          "Fügen Sie mindestens eine Rechnungszeile hinzu",
        ],

        ["ui", "invoice.updated", "en", "Invoice updated"],
        ["ui", "invoice.updated", "nl", "Factuur bijgewerkt"],
        ["ui", "invoice.updated", "de", "Rechnung aktualisiert"],

        ["ui", "invoice.saved", "en", "Invoice saved"],
        ["ui", "invoice.saved", "nl", "Factuur succesvol opgeslagen"],
        ["ui", "invoice.saved", "de", "Rechnung gespeichert"],

        [
          "ui",
          "invoice.templates_load_error_option",
          "en",
          "Error loading templates",
        ],
        [
          "ui",
          "invoice.templates_load_error_option",
          "nl",
          "Fout bij laden templates",
        ],
        [
          "ui",
          "invoice.templates_load_error_option",
          "de",
          "Fehler beim Laden der Vorlagen",
        ],

        ["ui", "invoice.none_found", "en", "No invoices found"],
        ["ui", "invoice.none_found", "nl", "Geen facturen gevonden"],
        ["ui", "invoice.none_found", "de", "Keine Rechnungen gefunden"],

        [
          "ui",
          "invoice.template_duplicate_failed",
          "en",
          "Error duplicating template",
        ],
        [
          "ui",
          "invoice.template_duplicate_failed",
          "nl",
          "Fout bij dupliceren template",
        ],
        [
          "ui",
          "invoice.template_duplicate_failed",
          "de",
          "Fehler beim Duplizieren der Vorlage",
        ],

        ["ui", "invoice.template_deleted", "en", "Invoice template deleted"],
        ["ui", "invoice.template_deleted", "nl", "Factuursjabloon verwijderd"],
        ["ui", "invoice.template_deleted", "de", "Rechnungsvorlage gelöscht"],

        [
          "ui",
          "confirm_delete_template",
          "en",
          "Are you sure you want to delete this template?",
        ],
        [
          "ui",
          "confirm_delete_template",
          "nl",
          "Weet je zeker dat je dit template wilt verwijderen?",
        ],
        [
          "ui",
          "confirm_delete_template",
          "de",
          "Möchten Sie diese Vorlage wirklich löschen?",
        ],

        [
          "ui",
          "invoice.template_delete_failed",
          "en",
          "Error deleting template",
        ],
        [
          "ui",
          "invoice.template_delete_failed",
          "nl",
          "Fout bij verwijderen template",
        ],
        [
          "ui",
          "invoice.template_delete_failed",
          "de",
          "Fehler beim Löschen der Vorlage",
        ],

        ["ui", "invoice.template_id_missing", "en", "Template ID not found"],
        [
          "ui",
          "invoice.template_id_missing",
          "nl",
          "Template ID niet gevonden",
        ],
        [
          "ui",
          "invoice.template_id_missing",
          "de",
          "Vorlagen-ID nicht gefunden",
        ],

        ["ui", "invoice.pdf_generating", "en", "Generating PDF..."],
        ["ui", "invoice.pdf_generating", "nl", "PDF wordt gegenereerd..."],
        ["ui", "invoice.pdf_generating", "de", "PDF wird erstellt..."],

        ["ui", "invoice.preview_failed", "en", "Error generating preview"],
        ["ui", "invoice.preview_failed", "nl", "Fout bij genereren preview"],
        [
          "ui",
          "invoice.preview_failed",
          "de",
          "Fehler beim Erstellen der Vorschau",
        ],

        ["ui", "invoice.prepare_failed", "en", "Error preparing invoice"],
        ["ui", "invoice.prepare_failed", "nl", "Fout bij voorbereiden factuur"],
        [
          "ui",
          "invoice.prepare_failed",
          "de",
          "Fehler bei der Vorbereitung der Rechnung",
        ],

        [
          "ui",
          "invoice.load_for_edit_failed",
          "en",
          "Error loading invoice for editing",
        ],
        [
          "ui",
          "invoice.load_for_edit_failed",
          "nl",
          "Fout bij laden factuur voor bewerken",
        ],
        [
          "ui",
          "invoice.load_for_edit_failed",
          "de",
          "Fehler beim Laden der Rechnung zum Bearbeiten",
        ],

        [
          "ui",
          "invoice.no_submission_history",
          "en",
          "No submission history found",
        ],
        [
          "ui",
          "invoice.no_submission_history",
          "nl",
          "Geen submission history gevonden",
        ],
        [
          "ui",
          "invoice.no_submission_history",
          "de",
          "Keine Übermittlungshistorie gefunden",
        ],

        [
          "ui",
          "invoice.submission_history_load_failed",
          "en",
          "Error loading submission history",
        ],
        [
          "ui",
          "invoice.submission_history_load_failed",
          "nl",
          "Fout bij laden submission history",
        ],
        [
          "ui",
          "invoice.submission_history_load_failed",
          "de",
          "Fehler beim Laden der Übermittlungshistorie",
        ],

        ["ui", "invoice.save_failed", "en", "Error saving invoice"],
        ["ui", "invoice.save_failed", "nl", "Fout bij opslaan factuur"],
        [
          "ui",
          "invoice.save_failed",
          "de",
          "Fehler beim Speichern der Rechnung",
        ],

        [
          "ui",
          "invoice.customer_filled_from_template",
          "en",
          "Customer filled from template",
        ],
        [
          "ui",
          "invoice.customer_filled_from_template",
          "nl",
          "Klantgegevens ingevuld vanuit template",
        ],
        [
          "ui",
          "invoice.customer_filled_from_template",
          "de",
          "Kundendaten aus Vorlage übernommen",
        ],

        [
          "ui",
          "invoice.customer_missing_in_template",
          "en",
          "No customer data found in template",
        ],
        [
          "ui",
          "invoice.customer_missing_in_template",
          "nl",
          "Geen klantgegevens gevonden in template",
        ],
        [
          "ui",
          "invoice.customer_missing_in_template",
          "de",
          "Keine Kundendaten in der Vorlage gefunden",
        ],

        [
          "ui",
          "invoice.template_data_load_failed",
          "en",
          "Error loading template data",
        ],
        [
          "ui",
          "invoice.template_data_load_failed",
          "nl",
          "Fout bij laden template gegevens",
        ],
        [
          "ui",
          "invoice.template_data_load_failed",
          "de",
          "Fehler beim Laden der Vorlagendaten",
        ],

        ["ui", "invoice.pdf_generated", "en", "PDF generated"],
        ["ui", "invoice.pdf_generated", "nl", "PDF succesvol gegenereerd"],
        ["ui", "invoice.pdf_generated", "de", "PDF erzeugt"],

        ["ui", "invoice.pdf_generate_failed", "en", "Error generating PDF"],
        ["ui", "invoice.pdf_generate_failed", "nl", "Fout bij genereren PDF"],
        [
          "ui",
          "invoice.pdf_generate_failed",
          "de",
          "Fehler bei der PDF-Erstellung",
        ],

        ["ui", "invoice.load_failed", "en", "Error loading invoice"],
        ["ui", "invoice.load_failed", "nl", "Fout bij laden factuur"],
        ["ui", "invoice.load_failed", "de", "Fehler beim Laden der Rechnung"],

        ["ui", "invoice.pdf_downloaded", "en", "PDF downloaded"],
        ["ui", "invoice.pdf_downloaded", "nl", "PDF gedownload"],
        ["ui", "invoice.pdf_downloaded", "de", "PDF heruntergeladen"],

        ["ui", "invoice.download_pdf_failed", "en", "Error downloading PDF"],
        ["ui", "invoice.download_pdf_failed", "nl", "Fout bij downloaden PDF"],
        [
          "ui",
          "invoice.download_pdf_failed",
          "de",
          "Fehler beim Herunterladen der PDF",
        ],

        [
          "ui",
          "invoice.original_pdf_downloading",
          "en",
          "Downloading original PDF...",
        ],
        [
          "ui",
          "invoice.original_pdf_downloading",
          "nl",
          "Originele PDF wordt gedownload...",
        ],
        [
          "ui",
          "invoice.original_pdf_downloading",
          "de",
          "Original-PDF wird heruntergeladen...",
        ],

        [
          "ui",
          "invoice.original_pdf_downloaded",
          "en",
          "Original PDF downloaded",
        ],
        [
          "ui",
          "invoice.original_pdf_downloaded",
          "nl",
          "Originele PDF gedownload",
        ],
        [
          "ui",
          "invoice.original_pdf_downloaded",
          "de",
          "Original-PDF heruntergeladen",
        ],

        ["ui", "invoice.download_original_pdf", "en", "Download Original PDF"],
        ["ui", "invoice.download_original_pdf", "nl", "Download Originele PDF"],
        [
          "ui",
          "invoice.download_original_pdf",
          "de",
          "Original-PDF herunterladen",
        ],

        [
          "ui",
          "invoice.download_original_pdf_failed",
          "en",
          "Error downloading original PDF",
        ],
        [
          "ui",
          "invoice.download_original_pdf_failed",
          "nl",
          "Fout bij downloaden originele PDF",
        ],
        [
          "ui",
          "invoice.download_original_pdf_failed",
          "de",
          "Fehler beim Herunterladen der Original-PDF",
        ],

        [
          "ui",
          "invoice.invoice_data_load_failed",
          "en",
          "Error loading invoice data",
        ],
        [
          "ui",
          "invoice.invoice_data_load_failed",
          "nl",
          "Fout bij laden factuurgegevens",
        ],
        [
          "ui",
          "invoice.invoice_data_load_failed",
          "de",
          "Fehler beim Laden der Rechnungsdaten",
        ],

        ["ui", "invoice.email_required", "en", "Email address is required"],
        ["ui", "invoice.email_required", "nl", "Email adres is verplicht"],
        [
          "ui",
          "invoice.email_required",
          "de",
          "E-Mail-Adresse ist erforderlich",
        ],

        ["ui", "invoice.email_sent", "en", "Invoice email sent"],
        ["ui", "invoice.email_sent", "nl", "Factuur succesvol verzonden"],
        ["ui", "invoice.email_sent", "de", "Rechnungs-E-Mail gesendet"],

        ["ui", "invoice.email_send_failed", "en", "Error sending email"],
        ["ui", "invoice.email_send_failed", "nl", "Fout bij verzenden email"],
        [
          "ui",
          "invoice.email_send_failed",
          "de",
          "Fehler beim Senden der E-Mail",
        ],

        [
          "ui",
          "confirm_delete_invoice",
          "en",
          "Are you sure you want to delete this invoice?",
        ],
        [
          "ui",
          "confirm_delete_invoice",
          "nl",
          "Weet je zeker dat je deze factuur wilt verwijderen?",
        ],
        [
          "ui",
          "confirm_delete_invoice",
          "de",
          "Möchten Sie diese Rechnung wirklich löschen?",
        ],

        ["ui", "invoice.deleted", "en", "Invoice deleted"],
        ["ui", "invoice.deleted", "nl", "Factuur verwijderd"],
        ["ui", "invoice.deleted", "de", "Rechnung gelöscht"],

        ["ui", "invoice.invoice_delete_failed", "en", "Error deleting invoice"],
        [
          "ui",
          "invoice.invoice_delete_failed",
          "nl",
          "Fout bij verwijderen factuur",
        ],
        [
          "ui",
          "invoice.invoice_delete_failed",
          "de",
          "Fehler beim Löschen der Rechnung",
        ],

        ["ui", "invoice.none_selected", "en", "No invoices selected"],
        ["ui", "invoice.none_selected", "nl", "Geen facturen geselecteerd"],
        ["ui", "invoice.none_selected", "de", "Keine Rechnungen ausgewählt"],

        [
          "ui",
          "invoice.confirm_delete_selected",
          "en",
          "Are you sure you want to delete {count} selected invoices?",
        ],
        [
          "ui",
          "invoice.confirm_delete_selected",
          "nl",
          "Weet je zeker dat je {count} geselecteerde facturen wilt verwijderen?",
        ],
        [
          "ui",
          "invoice.confirm_delete_selected",
          "de",
          "Möchten Sie {count} ausgewählte Rechnungen wirklich löschen?",
        ],

        ["ui", "invoice.selected_deleted", "en", "Selected invoices deleted"],
        [
          "ui",
          "invoice.selected_deleted",
          "nl",
          "Geselecteerde facturen verwijderd",
        ],
        [
          "ui",
          "invoice.selected_deleted",
          "de",
          "Ausgewählte Rechnungen gelöscht",
        ],

        ["ui", "invoice.deleted_short", "en", "deleted"],
        ["ui", "invoice.deleted_short", "nl", "verwijderd"],
        ["ui", "invoice.deleted_short", "de", "gelöscht"],

        ["ui", "invoice.failed_short", "en", "failed"],
        ["ui", "invoice.failed_short", "nl", "mislukt"],
        ["ui", "invoice.failed_short", "de", "fehlgeschlagen"],

        ["ui", "invoice.check_logs", "en", "Check log for details"],
        ["ui", "invoice.check_logs", "nl", "Controleer log voor details"],
        ["ui", "invoice.check_logs", "de", "Prüfen Sie das Log für Details"],

        [
          "ui",
          "invoice.none_found_before_date",
          "en",
          "No invoices found before {date}",
        ],
        [
          "ui",
          "invoice.none_found_before_date",
          "nl",
          "Geen facturen gevonden voor {date}",
        ],
        [
          "ui",
          "invoice.none_found_before_date",
          "de",
          "Keine Rechnungen vor {date} gefunden",
        ],

        [
          "ui",
          "invoice.confirm_delete_before_date",
          "en",
          "Delete all {count} invoices before {date}?",
        ],
        [
          "ui",
          "invoice.confirm_delete_before_date",
          "nl",
          "Alle {count} facturen voor {date} verwijderen?",
        ],
        [
          "ui",
          "invoice.confirm_delete_before_date",
          "de",
          "Alle {count} Rechnungen vor {date} löschen?",
        ],

        [
          "ui",
          "invoice.deleted_before_date",
          "en",
          "Deleted {count} old invoices before {date}",
        ],
        [
          "ui",
          "invoice.deleted_before_date",
          "nl",
          "{count} oude facturen verwijderd voor {date}",
        ],
        [
          "ui",
          "invoice.deleted_before_date",
          "de",
          "{count} alte Rechnungen vor {date} gelöscht",
        ],

        [
          "ui",
          "invoice.clear_all_warning",
          "en",
          "WARNING: This will delete ALL {count} invoices! Are you absolutely sure?",
        ],
        [
          "ui",
          "invoice.clear_all_warning",
          "nl",
          "WAARSCHUWING: Dit verwijdert ALLE {count} facturen! Weet je dit ABSOLUUT zeker?",
        ],
        [
          "ui",
          "invoice.clear_all_warning",
          "de",
          "WARNUNG: Dadurch werden ALLE {count} Rechnungen gelöscht! Sind Sie absolut sicher?",
        ],

        [
          "ui",
          "invoice.clear_all_final_confirm",
          "en",
          "This cannot be undone. Last chance to cancel.",
        ],
        [
          "ui",
          "invoice.clear_all_final_confirm",
          "nl",
          "Dit kan NIET ongedaan gemaakt worden! Laatste kans om te annuleren.",
        ],
        [
          "ui",
          "invoice.clear_all_final_confirm",
          "de",
          "Dies kann NICHT rückgängig gemacht werden! Letzte Chance zum Abbrechen.",
        ],

        ["ui", "invoice.all_deleted", "en", "All {count} invoices deleted"],
        ["ui", "invoice.all_deleted", "nl", "Alle {count} facturen verwijderd"],
        ["ui", "invoice.all_deleted", "de", "Alle {count} Rechnungen gelöscht"],

        [
          "ui",
          "invoice.import_settings_load_failed",
          "en",
          "Error loading import settings",
        ],
        [
          "ui",
          "invoice.import_settings_load_failed",
          "nl",
          "Fout bij laden import instellingen",
        ],
        [
          "ui",
          "invoice.import_settings_load_failed",
          "de",
          "Fehler beim Laden der Importeinstellungen",
        ],

        ["ui", "invoice.import_template_new", "en", "New Import Template"],
        ["ui", "invoice.import_template_new", "nl", "Nieuw Import Template"],
        ["ui", "invoice.import_template_new", "de", "Neue Importvorlage"],

        ["ui", "invoice.template_details", "en", "Template Details"],
        ["ui", "invoice.template_details", "nl", "Template Details"],
        ["ui", "invoice.template_details", "de", "Vorlagendetails"],

        ["ui", "invoice.template_name", "en", "Template Name"],
        ["ui", "invoice.template_name", "nl", "Template Naam"],
        ["ui", "invoice.template_name", "de", "Vorlagenname"],

        [
          "ui",
          "invoice.template_name_placeholder",
          "en",
          "e.g., Mainfreight Invoices",
        ],
        [
          "ui",
          "invoice.template_name_placeholder",
          "nl",
          "bijv. Mainfreight Facturen",
        ],
        [
          "ui",
          "invoice.template_name_placeholder",
          "de",
          "z.B. Mainfreight Rechnungen",
        ],

        ["ui", "invoice.description", "en", "Description"],
        ["ui", "invoice.description", "nl", "Beschrijving"],
        ["ui", "invoice.description", "de", "Beschreibung"],

        [
          "ui",
          "invoice.description_placeholder",
          "en",
          "Optional description for this import template",
        ],
        [
          "ui",
          "invoice.description_placeholder",
          "nl",
          "Optionele beschrijving van dit import template",
        ],
        [
          "ui",
          "invoice.description_placeholder",
          "de",
          "Optionale Beschreibung für diese Importvorlage",
        ],

        ["ui", "invoice.parser_type", "en", "Parser Type"],
        ["ui", "invoice.parser_type", "nl", "Parser Type"],
        ["ui", "invoice.parser_type", "de", "Parser-Typ"],

        ["ui", "invoice.select_parser_type", "en", "Select parser type"],
        ["ui", "invoice.select_parser_type", "nl", "Selecteer parser type"],
        ["ui", "invoice.select_parser_type", "de", "Parser-Typ auswählen"],

        [
          "ui",
          "invoice.import_template_required",
          "en",
          "Name and parser type are required",
        ],
        [
          "ui",
          "invoice.import_template_required",
          "nl",
          "Naam en parser type zijn verplicht",
        ],
        [
          "ui",
          "invoice.import_template_required",
          "de",
          "Name und Parser-Typ sind erforderlich",
        ],

        [
          "ui",
          "invoice.import_template_created",
          "en",
          "Import template created",
        ],
        [
          "ui",
          "invoice.import_template_created",
          "nl",
          "Import template aangemaakt",
        ],
        [
          "ui",
          "invoice.import_template_created",
          "de",
          "Importvorlage erstellt",
        ],

        [
          "ui",
          "invoice.import_template_save_failed",
          "en",
          "Error saving import template",
        ],
        [
          "ui",
          "invoice.import_template_save_failed",
          "nl",
          "Fout bij opslaan template",
        ],
        [
          "ui",
          "invoice.import_template_save_failed",
          "de",
          "Fehler beim Speichern der Importvorlage",
        ],

        [
          "ui",
          "invoice.import_template_delete_confirm",
          "en",
          "Delete this import template?",
        ],
        [
          "ui",
          "invoice.import_template_delete_confirm",
          "nl",
          "Dit import template verwijderen?",
        ],
        [
          "ui",
          "invoice.import_template_delete_confirm",
          "de",
          "Diese Importvorlage löschen?",
        ],

        [
          "ui",
          "invoice.feature_not_available",
          "en",
          "Feature not available yet",
        ],
        [
          "ui",
          "invoice.feature_not_available",
          "nl",
          "Functionaliteit nog niet beschikbaar",
        ],
        [
          "ui",
          "invoice.feature_not_available",
          "de",
          "Funktion noch nicht verfügbar",
        ],

        [
          "ui",
          "invoice.import_template_delete_failed",
          "en",
          "Error deleting import template",
        ],
        [
          "ui",
          "invoice.import_template_delete_failed",
          "nl",
          "Fout bij verwijderen template",
        ],
        [
          "ui",
          "invoice.import_template_delete_failed",
          "de",
          "Fehler beim Löschen der Importvorlage",
        ],

        ["ui", "admin.menu_management", "en", "Menu Management"],
        ["ui", "admin.menu_management", "nl", "Menubeheer"],
        ["ui", "admin.menu_management", "de", "Menüverwaltung"],

        ["ui", "back", "en", "Back"],
        ["ui", "back", "nl", "Terug"],
        ["ui", "back", "de", "Zurück"],

        ["ui", "info", "en", "Info"],
        ["ui", "info", "nl", "Informatie"],
        ["ui", "info", "de", "Info"],

        ["ui", "admin.translations", "en", "Translations"],
        ["ui", "admin.translations", "nl", "Vertalingen"],
        ["ui", "admin.translations", "de", "Übersetzungen"],

        ["ui", "menu.translation", "en", "Translation"],
        ["ui", "menu.translation", "nl", "Vertaling"],
        ["ui", "menu.translation", "de", "Übersetzung"],

        ["ui", "loaded_translations", "en", "Loaded translations"],
        ["ui", "loaded_translations", "nl", "Vertalingen geladen"],
        ["ui", "loaded_translations", "de", "Übersetzungen geladen"],

        [
          "ui",
          "error_loading_translations",
          "en",
          "Error loading translations",
        ],
        [
          "ui",
          "error_loading_translations",
          "nl",
          "Fout bij laden van vertalingen",
        ],
        [
          "ui",
          "error_loading_translations",
          "de",
          "Fehler beim Laden der Übersetzungen",
        ],

        ["ui", "translations_saved", "en", "Translations saved"],
        ["ui", "translations_saved", "nl", "Vertalingen opgeslagen"],
        ["ui", "translations_saved", "de", "Übersetzungen gespeichert"],

        ["ui", "added_locale", "en", "Added locale"],
        ["ui", "added_locale", "nl", "Taal toegevoegd"],
        ["ui", "added_locale", "de", "Sprache hinzugefügt"],

        ["ui", "exported_template", "en", "Exported template"],
        ["ui", "exported_template", "nl", "Template geëxporteerd"],
        ["ui", "exported_template", "de", "Vorlage exportiert"],

        ["ui", "error_exporting_template", "en", "Error exporting template"],
        [
          "ui",
          "error_exporting_template",
          "nl",
          "Fout bij exporteren van template",
        ],
        [
          "ui",
          "error_exporting_template",
          "de",
          "Fehler beim Exportieren der Vorlage",
        ],

        [
          "ui",
          "translations.subtitle",
          "en",
          "Manage UI copy across locales with live preview.",
        ],
        [
          "ui",
          "translations.subtitle",
          "nl",
          "Beheer UI-teksten per taal met live preview.",
        ],
        [
          "ui",
          "translations.subtitle",
          "de",
          "Verwalte UI-Texte pro Sprache mit Live-Vorschau.",
        ],
        ["ui", "translations.live_preview", "en", "Live preview ready"],
        ["ui", "translations.live_preview", "nl", "Live preview klaar"],
        ["ui", "translations.live_preview", "de", "Live-Vorschau bereit"],
        ["ui", "translations.bulk_edit", "en", "Bulk edit friendly"],
        ["ui", "translations.bulk_edit", "nl", "Geschikt voor bulkbewerking"],
        ["ui", "translations.bulk_edit", "de", "Für Bulk-Bearbeitung geeignet"],
        [
          "ui",
          "translations.toolbar_hint",
          "en",
          "Import/export or bulk edit below.",
        ],
        [
          "ui",
          "translations.toolbar_hint",
          "nl",
          "Importeer/exporteer of bewerk hieronder.",
        ],
        [
          "ui",
          "translations.toolbar_hint",
          "de",
          "Import/Export oder Bulk-Edit unten.",
        ],
        ["ui", "translations.filter", "en", "Filter"],
        ["ui", "translations.filter", "nl", "Filter"],
        ["ui", "translations.filter", "de", "Filter"],
        [
          "ui",
          "translations.filter_placeholder",
          "en",
          "Filter by key or text",
        ],
        [
          "ui",
          "translations.filter_placeholder",
          "nl",
          "Filter op sleutel of tekst",
        ],
        [
          "ui",
          "translations.filter_placeholder",
          "de",
          "Nach Schlüssel oder Text filtern",
        ],
        ["ui", "translations.workspace", "en", "Workspace"],
        ["ui", "translations.workspace", "nl", "Werkruimte"],
        ["ui", "translations.workspace", "de", "Arbeitsbereich"],
        ["ui", "translations.auto_translate", "en", "Auto-translate missing"],
        ["ui", "translations.auto_translate", "nl", "Automatisch vertalen"],
        ["ui", "translations.auto_translate", "de", "Automatisch übersetzen"],
        ["ui", "translations.source_locale", "en", "Source locale"],
        ["ui", "translations.source_locale", "nl", "Bron-taal"],
        ["ui", "translations.source_locale", "de", "Ausgangssprache"],
        ["ui", "translations.provider", "en", "Provider"],
        ["ui", "translations.provider", "nl", "Provider"],
        ["ui", "translations.provider", "de", "Provider"],
        ["ui", "translations.provider.deepl", "en", "DeepL"],
        ["ui", "translations.provider.deepl", "nl", "DeepL"],
        ["ui", "translations.provider.deepl", "de", "DeepL"],
        ["ui", "translations.provider.google", "en", "Google"],
        ["ui", "translations.provider.google", "nl", "Google"],
        ["ui", "translations.provider.google", "de", "Google"],
        ["ui", "translations.translating", "en", "Translating..."],
        ["ui", "translations.translating", "nl", "Vertalen..."],
        ["ui", "translations.translating", "de", "Übersetzen..."],
        ["ui", "translations.auto_translated", "en", "Auto-translated"],
        ["ui", "translations.auto_translated", "nl", "Automatisch vertaald"],
        ["ui", "translations.auto_translated", "de", "Automatisch übersetzt"],
        [
          "ui",
          "translations.auto_translate_hint",
          "en",
          "Fill empty texts using the selected provider.",
        ],
        [
          "ui",
          "translations.auto_translate_hint",
          "nl",
          "Vul lege teksten aan met de gekozen provider.",
        ],
        [
          "ui",
          "translations.auto_translate_hint",
          "de",
          "Leere Texte mit dem gewählten Provider füllen.",
        ],

        // Top navigation menu labels (namespace: menu)
        ["menu", "dashboard", "en", "Dashboard"],
        ["menu", "dashboard", "nl", "Startpagina"],
        ["menu", "dashboard", "de", "Startseite"],
        ["menu", "history", "en", "History"],
        ["menu", "history", "nl", "Historie"],
        ["menu", "history", "de", "Verlauf"],
        ["menu", "weekly-hours", "en", "Weekly Hours"],
        ["menu", "weekly-hours", "nl", "Weekuren"],
        ["menu", "weekly-hours", "de", "Wochenstunden"],
        ["menu", "leave", "en", "Leave"],
        ["menu", "leave", "nl", "Verlof"],
        ["menu", "leave", "de", "Urlaub"],
        ["menu", "invoices", "en", "Invoices"],
        ["menu", "invoices", "nl", "Facturen"],
        ["menu", "invoices", "de", "Rechnungen"],
        ["menu", "revenue", "en", "Revenue"],
        ["menu", "revenue", "nl", "Omzet"],
        ["menu", "revenue", "de", "Umsatz"],
        ["menu", "admin", "en", "Admin"],
        ["menu", "admin", "nl", "Admin"],
        ["menu", "admin", "de", "Admin"],

        // Page headings and common actions
        ["ui", "dashboard.timesheet_entry", "en", "Timesheet Entry"],
        ["ui", "dashboard.timesheet_entry", "nl", "Urenregistratie"],
        ["ui", "dashboard.timesheet_entry", "de", "Stundenerfassung"],
        ["ui", "dashboard.select_company", "en", "Select company..."],
        ["ui", "dashboard.select_company", "nl", "Selecteer bedrijf..."],
        ["ui", "dashboard.select_company", "de", "Firma auswählen..."],

        ["ui", "add_row", "en", "Add Row"],
        ["ui", "add_row", "nl", "Rij toevoegen"],
        ["ui", "add_row", "de", "Zeile hinzufügen"],
        ["ui", "save_all", "en", "Save All"],
        ["ui", "save_all", "nl", "Alles opslaan"],
        ["ui", "save_all", "de", "Alle speichern"],
        ["ui", "submit", "en", "Submit"],
        ["ui", "submit", "nl", "Verzenden"],
        ["ui", "submit", "de", "Senden"],
        ["ui", "preview_pdf", "en", "Preview PDF"],
        ["ui", "preview_pdf", "nl", "PDF voorbeeld"],
        ["ui", "preview_pdf", "de", "PDF Vorschau"],
        ["ui", "preview_excel", "en", "Preview Excel"],
        ["ui", "preview_excel", "nl", "Excel voorbeeld"],
        ["ui", "preview_excel", "de", "Excel Vorschau"],
        ["ui", "submit_send_email", "en", "Submit & Send Email"],
        ["ui", "submit_send_email", "nl", "Verzenden & E-mail sturen"],
        ["ui", "submit_send_email", "de", "Senden & E-Mail verschicken"],

        ["ui", "confirm_delete", "en", "Confirm Delete"],
        ["ui", "confirm_delete", "nl", "Verwijderen bevestigen"],
        ["ui", "confirm_delete", "de", "Löschen bestätigen"],
        [
          "ui",
          "delete_timesheet_confirm",
          "en",
          "Are you sure you want to delete this timesheet entry?",
        ],
        [
          "ui",
          "delete_timesheet_confirm",
          "nl",
          "Weet je zeker dat je deze urenregel wilt verwijderen?",
        ],
        [
          "ui",
          "delete_timesheet_confirm",
          "de",
          "Möchten Sie diesen Stundeneintrag wirklich löschen?",
        ],
        [
          "ui",
          "this_action_cannot_be_undone",
          "en",
          "This action cannot be undone.",
        ],
        [
          "ui",
          "this_action_cannot_be_undone",
          "nl",
          "Deze actie kan niet ongedaan worden gemaakt.",
        ],
        [
          "ui",
          "this_action_cannot_be_undone",
          "de",
          "Diese Aktion kann nicht rückgängig gemacht werden.",
        ],
        ["ui", "cancel", "en", "Cancel"],
        ["ui", "cancel", "nl", "Annuleren"],
        ["ui", "cancel", "de", "Abbrechen"],
        ["ui", "delete_entry", "en", "Delete Entry"],
        ["ui", "delete_entry", "nl", "Regel verwijderen"],
        ["ui", "delete_entry", "de", "Eintrag löschen"],

        ["ui", "history.title", "en", "Submission History"],
        ["ui", "history.title", "nl", "Inzendgeschiedenis"],
        ["ui", "history.title", "de", "Übermittlungshistorie"],
        ["ui", "history.filter_company", "en", "Filter by Company:"],
        ["ui", "history.filter_company", "nl", "Filter op bedrijf:"],
        ["ui", "history.filter_company", "de", "Nach Firma filtern:"],
        ["ui", "history.all_companies", "en", "All Companies"],
        ["ui", "history.all_companies", "nl", "Alle bedrijven"],
        ["ui", "history.all_companies", "de", "Alle Firmen"],
        ["ui", "pdf", "en", "PDF"],
        ["ui", "pdf", "nl", "PDF"],
        ["ui", "pdf", "de", "PDF"],
        ["ui", "excel", "en", "Excel"],
        ["ui", "excel", "nl", "Excel"],
        ["ui", "excel", "de", "Excel"],
        ["ui", "send_email", "en", "Send Email"],
        ["ui", "send_email", "nl", "E-mail verzenden"],
        ["ui", "send_email", "de", "E-Mail senden"],
        ["ui", "import", "en", "Import"],
        ["ui", "import", "nl", "Importeren"],
        ["ui", "import", "de", "Importieren"],

        ["ui", "weekly.title", "en", "Weekly Hours Summary"],
        ["ui", "weekly.title", "nl", "Urenoverzicht per week"],
        ["ui", "weekly.title", "de", "Wöchentliche Stundenübersicht"],
        ["ui", "weekly.week_number", "en", "Week Number"],
        ["ui", "weekly.week_number", "nl", "Weeknummer"],
        ["ui", "weekly.week_number", "de", "Wochennummer"],
        ["ui", "weekly.work_days", "en", "Work Days"],
        ["ui", "weekly.work_days", "nl", "Werkdagen"],
        ["ui", "weekly.work_days", "de", "Arbeitstage"],
        ["ui", "weekly.total_hours", "en", "Total Hours"],
        ["ui", "weekly.total_hours", "nl", "Totaal uren"],
        ["ui", "weekly.total_hours", "de", "Gesamtstunden"],
        ["ui", "weekly.overworked", "en", "Overworked"],
        ["ui", "weekly.overworked", "nl", "Overgewerkt"],
        ["ui", "weekly.overworked", "de", "Überarbeitet"],
        ["ui", "previous", "en", "Previous"],
        ["ui", "previous", "nl", "Vorige"],
        ["ui", "previous", "de", "Zurück"],
        ["ui", "next", "en", "Next"],
        ["ui", "next", "nl", "Volgende"],
        ["ui", "next", "de", "Weiter"],

        ["ui", "leave.balance", "en", "Leave Balance"],
        ["ui", "leave.balance", "nl", "Verlofsaldo"],
        ["ui", "leave.balance", "de", "Urlaubssaldo"],
        ["ui", "leave.request", "en", "Leave Request"],
        ["ui", "leave.request", "nl", "Verlofaanvraag"],
        ["ui", "leave.request", "de", "Urlaubsantrag"],
        ["ui", "leave.type", "en", "Type"],
        ["ui", "leave.type", "nl", "Type"],
        ["ui", "leave.type", "de", "Typ"],
        ["ui", "leave.type_vacation", "en", "Vacation"],
        ["ui", "leave.type_vacation", "nl", "Verlof"],
        ["ui", "leave.type_vacation", "de", "Urlaub"],
        ["ui", "leave.type_overtime", "en", "Overtime"],
        ["ui", "leave.type_overtime", "nl", "Overuren"],
        ["ui", "leave.type_overtime", "de", "Überstunden"],
        ["ui", "leave.start_date", "en", "Start Date"],
        ["ui", "leave.start_date", "nl", "Vanaf datum"],
        ["ui", "leave.start_date", "de", "Startdatum"],
        ["ui", "leave.end_date", "en", "End Date"],
        ["ui", "leave.end_date", "nl", "Tot en met"],
        ["ui", "leave.end_date", "de", "Enddatum"],
        ["ui", "leave.hours_auto", "en", "Hours (auto)"],
        ["ui", "leave.hours_auto", "nl", "Uren (auto)"],
        ["ui", "leave.hours_auto", "de", "Stunden (auto)"],
        ["ui", "leave.start_time", "en", "Start Time"],
        ["ui", "leave.start_time", "nl", "Vanaf tijd"],
        ["ui", "leave.start_time", "de", "Startzeit"],
        ["ui", "leave.end_time", "en", "End Time"],
        ["ui", "leave.end_time", "nl", "Tot tijd"],
        ["ui", "leave.end_time", "de", "Endzeit"],
        ["ui", "leave.reason", "en", "Reason (optional)"],
        ["ui", "leave.reason", "nl", "Toelichting (optioneel)"],
        ["ui", "leave.reason", "de", "Grund (optional)"],
        ["ui", "leave.submit_request", "en", "Submit Request"],
        ["ui", "leave.submit_request", "nl", "Aanvraag indienen"],
        ["ui", "leave.submit_request", "de", "Antrag einreichen"],
        ["ui", "leave.my_requests", "en", "My Requests"],
        ["ui", "leave.my_requests", "nl", "Mijn aanvragen"],
        ["ui", "leave.my_requests", "de", "Meine Anträge"],
        ["ui", "leave.period", "en", "Period"],
        ["ui", "leave.period", "nl", "Periode"],
        ["ui", "leave.period", "de", "Zeitraum"],
        ["ui", "leave.hours", "en", "Hours"],
        ["ui", "leave.hours", "nl", "Uren"],
        ["ui", "leave.hours", "de", "Stunden"],
        ["ui", "leave.type_col", "en", "Type"],
        ["ui", "leave.type_col", "nl", "Type"],
        ["ui", "leave.type_col", "de", "Typ"],
        ["ui", "leave.status", "en", "Status"],
        ["ui", "leave.status", "nl", "Status"],
        ["ui", "leave.status", "de", "Status"],
        ["ui", "leave.note", "en", "Note"],
        ["ui", "leave.note", "nl", "Opmerking"],
        ["ui", "leave.note", "de", "Notiz"],
        ["ui", "leave.calendar_title", "en", "Leave Calendar - Team Overview"],
        ["ui", "leave.calendar_title", "nl", "Verlofkalender - Team Overzicht"],
        ["ui", "leave.calendar_title", "de", "Urlaubskalender - Teamübersicht"],
        ["ui", "leave.prev_month", "en", "Previous month"],
        ["ui", "leave.prev_month", "nl", "Vorige maand"],
        ["ui", "leave.prev_month", "de", "Vorheriger Monat"],
        ["ui", "leave.today", "en", "Today"],
        ["ui", "leave.today", "nl", "Vandaag"],
        ["ui", "leave.today", "de", "Heute"],
        ["ui", "leave.next_month", "en", "Next month"],
        ["ui", "leave.next_month", "nl", "Volgende maand"],
        ["ui", "leave.next_month", "de", "Nächster Monat"],
        ["ui", "leave.hours_unit", "en", "h"],
        ["ui", "leave.hours_unit", "nl", "u"],
        ["ui", "leave.hours_unit", "de", "Std"],
        ["ui", "leave.no_requests", "en", "No requests"],
        ["ui", "leave.no_requests", "nl", "Geen aanvragen"],
        ["ui", "leave.no_requests", "de", "Keine Anträge"],
        ["ui", "leave.to", "en", "to"],
        ["ui", "leave.to", "nl", "t/m"],
        ["ui", "leave.to", "de", "bis"],
        ["ui", "leave.time_separator", "en", " - "],
        ["ui", "leave.time_separator", "nl", " - "],
        ["ui", "leave.time_separator", "de", " - "],
        ["ui", "leave.status_approved", "en", "Approved"],
        ["ui", "leave.status_approved", "nl", "Goedgekeurd"],
        ["ui", "leave.status_approved", "de", "Genehmigt"],
        ["ui", "leave.status_rejected", "en", "Rejected"],
        ["ui", "leave.status_rejected", "nl", "Afgewezen"],
        ["ui", "leave.status_rejected", "de", "Abgelehnt"],
        ["ui", "leave.status_pending", "en", "Pending"],
        ["ui", "leave.status_pending", "nl", "In afwachting"],
        ["ui", "leave.status_pending", "de", "Ausstehend"],
        [
          "ui",
          "leave.balance_hint",
          "en",
          "Available for requests. Requests are deducted immediately.",
        ],
        [
          "ui",
          "leave.balance_hint",
          "nl",
          "Beschikbaar voor aanvragen. Aanvragen worden direct verrekend.",
        ],
        [
          "ui",
          "leave.balance_hint",
          "de",
          "Verfügbar für Anträge. Anträge werden sofort abgezogen.",
        ],
        [
          "ui",
          "leave.validation_required",
          "en",
          "Please fill all required fields and use a valid hours value.",
        ],
        [
          "ui",
          "leave.validation_required",
          "nl",
          "Vul alle verplichte velden in en gebruik een geldige urenwaarde.",
        ],
        [
          "ui",
          "leave.validation_required",
          "de",
          "Bitte füllen Sie alle Pflichtfelder aus und verwenden Sie einen gültigen Stundenwert.",
        ],
        ["ui", "leave.updating", "en", "Updating request..."],
        ["ui", "leave.updating", "nl", "Aanvraag wordt bijgewerkt..."],
        ["ui", "leave.updating", "de", "Antrag wird aktualisiert..."],
        [
          "ui",
          "leave.updated_success",
          "en",
          "Request updated and balance adjusted.",
        ],
        [
          "ui",
          "leave.updated_success",
          "nl",
          "Aanvraag bijgewerkt en saldo aangepast.",
        ],
        [
          "ui",
          "leave.updated_success",
          "de",
          "Antrag aktualisiert und Saldo angepasst.",
        ],
        ["ui", "leave.submitting", "en", "Submitting request..."],
        ["ui", "leave.submitting", "nl", "Aanvraag wordt verzonden..."],
        ["ui", "leave.submitting", "de", "Antrag wird eingereicht..."],
        [
          "ui",
          "leave.submitted",
          "en",
          "Request submitted and balance updated.",
        ],
        [
          "ui",
          "leave.submitted",
          "nl",
          "Aanvraag verzonden en saldo bijgewerkt.",
        ],
        [
          "ui",
          "leave.submitted",
          "de",
          "Antrag eingereicht und Saldo aktualisiert.",
        ],
        [
          "ui",
          "leave.withdraw_confirm",
          "en",
          "Are you sure you want to withdraw this leave request? The hours will be refunded.",
        ],
        [
          "ui",
          "leave.withdraw_confirm",
          "nl",
          "Weet je zeker dat je deze verlofaanvraag wilt intrekken? De uren worden teruggestort.",
        ],
        [
          "ui",
          "leave.withdraw_confirm",
          "de",
          "Sind Sie sicher, dass Sie diesen Urlaubsantrag zurückziehen möchten? Die Stunden werden zurückerstattet.",
        ],
        ["ui", "leave.withdraw_error", "en", "Error while withdrawing"],
        ["ui", "leave.withdraw_error", "nl", "Fout bij intrekken"],
        ["ui", "leave.withdraw_error", "de", "Fehler beim Zurückziehen"],
        ["ui", "leave.employee", "en", "Employee"],
        ["ui", "leave.employee", "nl", "Medewerker"],
        ["ui", "leave.employee", "de", "Mitarbeiter"],
        [
          "ui",
          "leave.calendar_empty",
          "en",
          "No approved leave requests found",
        ],
        [
          "ui",
          "leave.calendar_empty",
          "nl",
          "Geen goedgekeurde verlofaanvragen gevonden",
        ],
        [
          "ui",
          "leave.calendar_empty",
          "de",
          "Keine genehmigten Urlaubsanträge gefunden",
        ],
        ["ui", "leave.calendar_loading", "en", "Loading calendar..."],
        ["ui", "leave.calendar_loading", "nl", "Kalender laden..."],
        ["ui", "leave.calendar_loading", "de", "Kalender wird geladen..."],

        ["ui", "revenue.title", "en", "Revenue"],
        ["ui", "revenue.title", "nl", "Omzet"],
        ["ui", "revenue.title", "de", "Umsatz"],
        [
          "ui",
          "revenue.subtitle",
          "en",
          "Overview by week / month / quarter based on invoice totals.",
        ],
        [
          "ui",
          "revenue.subtitle",
          "nl",
          "Overzicht per week / maand / kwartaal op basis van factuur totaalbedragen.",
        ],
        [
          "ui",
          "revenue.subtitle",
          "de",
          "Übersicht pro Woche / Monat / Quartal basierend auf Rechnungsbeträgen.",
        ],
        ["ui", "revenue.error_loading", "en", "Error loading revenue data"],
        ["ui", "revenue.error_loading", "nl", "Fout bij laden omzetgegevens"],
        [
          "ui",
          "revenue.error_loading",
          "de",
          "Fehler beim Laden der Umsatzdaten",
        ],
        ["ui", "revenue.all_customers", "en", "All customers"],
        ["ui", "revenue.all_customers", "nl", "Alle klanten"],
        ["ui", "revenue.all_customers", "de", "Alle Kunden"],
        ["ui", "revenue.all_years", "en", "All years"],
        ["ui", "revenue.all_years", "nl", "Alle jaren"],
        ["ui", "revenue.all_years", "de", "Alle Jahre"],
        ["ui", "revenue.per_week", "en", "Per week"],
        ["ui", "revenue.per_week", "nl", "Per week"],
        ["ui", "revenue.per_week", "de", "Pro Woche"],
        ["ui", "revenue.per_month", "en", "Per month"],
        ["ui", "revenue.per_month", "nl", "Per maand"],
        ["ui", "revenue.per_month", "de", "Pro Monat"],
        ["ui", "revenue.per_quarter", "en", "Per quarter"],
        ["ui", "revenue.per_quarter", "nl", "Per kwartaal"],
        ["ui", "revenue.per_quarter", "de", "Pro Quartal"],

        ["ui", "summary", "en", "Summary"],
        ["ui", "summary", "nl", "Samenvatting"],
        ["ui", "summary", "de", "Zusammenfassung"],
        ["ui", "refresh", "en", "Refresh"],
        ["ui", "refresh", "nl", "Vernieuwen"],
        ["ui", "refresh", "de", "Aktualisieren"],

        ["ui", "invoices.title", "en", "Invoices"],
        ["ui", "invoices.title", "nl", "Facturen"],
        ["ui", "invoices.title", "de", "Rechnungen"],
        ["ui", "invoices.new_invoice", "en", "New Invoice"],
        ["ui", "invoices.new_invoice", "nl", "Nieuwe Factuur"],
        ["ui", "invoices.new_invoice", "de", "Neue Rechnung"],
        ["ui", "invoices.templates", "en", "Templates"],
        ["ui", "invoices.templates", "nl", "Templates"],
        ["ui", "invoices.templates", "de", "Vorlagen"],
        ["ui", "invoices.import_pdf", "en", "Import PDF"],
        ["ui", "invoices.import_pdf", "nl", "Importeer PDF"],
        ["ui", "invoices.import_pdf", "de", "PDF importieren"],
        [
          "ui",
          "invoices.search_placeholder",
          "en",
          "Search by invoice number or customer...",
        ],
        [
          "ui",
          "invoices.search_placeholder",
          "nl",
          "Zoek op factuurnummer of klant...",
        ],
        [
          "ui",
          "invoices.search_placeholder",
          "de",
          "Nach Rechnungsnummer oder Kunde suchen...",
        ],
        ["ui", "invoices.all_statuses", "en", "All statuses"],
        ["ui", "invoices.all_statuses", "nl", "Alle statussen"],
        ["ui", "invoices.all_statuses", "de", "Alle Status"],
        ["ui", "invoices.status_draft", "en", "Draft"],
        ["ui", "invoices.status_draft", "nl", "Concept"],
        ["ui", "invoices.status_draft", "de", "Entwurf"],
        ["ui", "invoices.status_sent", "en", "Sent"],
        ["ui", "invoices.status_sent", "nl", "Verzonden"],
        ["ui", "invoices.status_sent", "de", "Gesendet"],
        ["ui", "invoices.status_paid", "en", "Paid"],
        ["ui", "invoices.status_paid", "nl", "Betaald"],
        ["ui", "invoices.status_paid", "de", "Bezahlt"],
        ["ui", "invoices.status_cancelled", "en", "Cancelled"],
        ["ui", "invoices.status_cancelled", "nl", "Geannuleerd"],
        ["ui", "invoices.status_cancelled", "de", "Storniert"],
        ["ui", "invoices.delete_old", "en", "Delete old invoices"],
        ["ui", "invoices.delete_old", "nl", "Verwijder oude facturen"],
        ["ui", "invoices.delete_old", "de", "Alte Rechnungen löschen"],
        ["ui", "invoices.clear_all", "en", "Clear all"],
        ["ui", "invoices.clear_all", "nl", "Alles wissen"],
        ["ui", "invoices.clear_all", "de", "Alle löschen"],
        ["ui", "invoices.number", "en", "Invoice Number"],
        ["ui", "invoices.number", "nl", "Factuurnummer"],
        ["ui", "invoices.number", "de", "Rechnungsnummer"],
        ["ui", "invoices.customer", "en", "Customer"],
        ["ui", "invoices.customer", "nl", "Klant"],
        ["ui", "invoices.customer", "de", "Kunde"],
        ["ui", "invoices.date", "en", "Date"],
        ["ui", "invoices.date", "nl", "Datum"],
        ["ui", "invoices.date", "de", "Datum"],
        ["ui", "invoices.total", "en", "Total"],
        ["ui", "invoices.total", "nl", "Bedrag"],
        ["ui", "invoices.total", "de", "Summe"],
        ["ui", "invoices.status", "en", "Status"],
        ["ui", "invoices.status", "nl", "Status"],
        ["ui", "invoices.status", "de", "Status"],
      ];
      uiDefaults.forEach((u) => {
        // Use INSERT OR IGNORE to avoid UNIQUE constraint errors
        this.db.run(
          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`,
          u,
          (err) => {
            if (err && !err.message.includes("UNIQUE constraint failed"))
              console.error("Error inserting ui translation", err.message);
          }
        );
      });

      // Seed field translations for User and Fleet forms (en/nl/de)
      const fieldDefaults = [
        ["field", "users.username", "en", "Username *"],
        ["field", "users.username", "nl", "Gebruikersnaam *"],
        ["field", "users.username", "de", "Benutzername *"],

        ["field", "users.password", "en", "Password *"],
        ["field", "users.password", "nl", "Wachtwoord *"],
        ["field", "users.password", "de", "Passwort *"],

        ["field", "users.fullName", "en", "Full Name *"],
        ["field", "users.fullName", "nl", "Volledige naam *"],
        ["field", "users.fullName", "de", "Vollständiger Name *"],

        ["field", "users.phone", "en", "Phone Number"],
        ["field", "users.phone", "nl", "Telefoonnummer"],
        ["field", "users.phone", "de", "Telefonnummer"],

        ["field", "users.ritnumber", "en", "Rit Number"],
        ["field", "users.ritnumber", "nl", "Rit nummer"],
        ["field", "users.ritnumber", "de", "Rit-Nummer"],

        ["field", "users.role", "en", "Role"],
        ["field", "users.role", "nl", "Rol"],
        ["field", "users.role", "de", "Rolle"],

        ["field", "users.truckType", "en", "Truck Type"],
        ["field", "users.truckType", "nl", "Truck Type"],
        ["field", "users.truckType", "de", "Truck-Typ"],

        // Timesheet row labels
        ["field", "week", "en", "Week"],
        ["field", "week", "nl", "Week"],
        ["field", "week", "de", "Woche"],

        ["field", "ritnumber", "en", "Ritnumber"],
        ["field", "ritnumber", "nl", "Rit nummer"],
        ["field", "ritnumber", "de", "Ritnumber"],

        ["field", "name", "en", "Name"],
        ["field", "name", "nl", "Naam"],
        ["field", "name", "de", "Name"],

        ["field", "date", "en", "Date"],
        ["field", "date", "nl", "Datum"],
        ["field", "date", "de", "Datum"],

        ["field", "start", "en", "Start"],
        ["field", "start", "nl", "Start"],
        ["field", "start", "de", "Start"],

        ["field", "end", "en", "End"],
        ["field", "end", "nl", "Einde"],
        ["field", "end", "de", "Ende"],

        ["field", "start_km", "en", "Start KM"],
        ["field", "start_km", "nl", "Start KM"],
        ["field", "start_km", "de", "Start KM"],

        ["field", "end_km", "en", "End KM"],
        ["field", "end_km", "nl", "Eind KM"],
        ["field", "end_km", "de", "End KM"],

        ["field", "pause", "en", "Pause"],
        ["field", "pause", "nl", "Pauze"],
        ["field", "pause", "de", "Pause"],

        ["field", "hours", "en", "Hours"],
        ["field", "hours", "nl", "Uren"],
        ["field", "hours", "de", "Stunden"],

        ["field", "km", "en", "KM"],
        ["field", "km", "nl", "KM"],
        ["field", "km", "de", "KM"],

        ["field", "users.adr", "en", "ADR"],
        ["field", "users.adr", "nl", "ADR"],
        ["field", "users.adr", "de", "ADR"],

        ["field", "users.company", "en", "Company"],
        ["field", "users.company", "nl", "Bedrijf"],
        ["field", "users.company", "de", "Firma"],

        ["field", "fleet.license_plate", "en", "License Plate"],
        ["field", "fleet.license_plate", "nl", "Kenteken"],
        ["field", "fleet.license_plate", "de", "Kennzeichen"],

        ["field", "fleet.company", "en", "Company"],
        ["field", "fleet.company", "nl", "Bedrijf"],
        ["field", "fleet.company", "de", "Firma"],

        ["field", "fleet.km", "en", "KM"],
        ["field", "fleet.km", "nl", "KM"],
        ["field", "fleet.km", "de", "KM"],

        ["field", "fleet.apk_due_date", "en", "APK Due Date"],
        ["field", "fleet.apk_due_date", "nl", "APK geldig tot"],
        ["field", "fleet.apk_due_date", "de", "APK gültig bis"],

        ["field", "fleet.rit_number", "en", "Rit Number"],
        ["field", "fleet.rit_number", "nl", "Rit nummer"],
        ["field", "fleet.rit_number", "de", "Rit-Nummer"],

        ["field", "fleet.truck_type", "en", "Truck Type"],
        ["field", "fleet.truck_type", "nl", "Truck Type"],
        ["field", "fleet.truck_type", "de", "Truck-Typ"],
      ];

      fieldDefaults.forEach((f) => {
        // Use INSERT OR IGNORE to avoid UNIQUE constraint errors
        this.db.run(
          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`,
          f,
          (err) => {
            if (err && !err.message.includes("UNIQUE constraint failed"))
              console.error("Error inserting field translation", err.message);
          }
        );
      });

      // Submissions
      this.db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          user_name TEXT,
          submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          timesheet_ids TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          week_numbers TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Ensure week_numbers column exists (for existing tables)
      this.db.serialize(() => {
        this.db.all(`PRAGMA table_info(submissions)`, [], (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("week_numbers")) {
              console.log("Adding week_numbers column to submissions table");
              this.db.run(
                `ALTER TABLE submissions ADD COLUMN week_numbers TEXT`,
                (err) => {
                  if (err && !err.message.includes("duplicate column"))
                    console.error("Error adding week_numbers:", err);
                }
              );
            }
            // Remove old period columns if they exist
            if (columnNames.includes("period")) {
              console.log("Removing old period column from submissions table");
            }
            if (columnNames.includes("period_start")) {
              console.log(
                "Removing old period_start column from submissions table"
              );
            }
            if (columnNames.includes("period_end")) {
              console.log(
                "Removing old period_end column from submissions table"
              );
            }
          }
        });
      });

      // Leave balances
      this.db.run(`
        CREATE TABLE IF NOT EXISTS leave_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          vacation_hours REAL DEFAULT 0,
          overtime_hours REAL DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Companies
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          address TEXT,
          postal_code TEXT,
          city TEXT,
          kvk_number TEXT,
          bank_account TEXT,
          vat_number TEXT,
          pause_time TEXT DEFAULT '00:30',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(`PRAGMA table_info(companies)`, [], (err, columns) => {
              if (!err && columns) {
                const hasPause = columns.some((c) => c.name === "pause_time");
                if (!hasPause) {
                  this.db.run(
                    `ALTER TABLE companies ADD COLUMN pause_time TEXT DEFAULT '00:30'`
                  );
                }
              }
            });
          }
        }
      );

      // Leave requests
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS leave_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          start_time TEXT,
          end_time TEXT,
          hours_requested REAL NOT NULL,
          balance_type TEXT NOT NULL CHECK(balance_type IN ('vacation','overtime')),
          reason TEXT,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          admin_note TEXT,
          approved_by INTEGER,
          decision_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(
              `PRAGMA table_info(leave_requests)`,
              [],
              (err, columns) => {
                if (!err && columns) {
                  const hasStart = columns.some((c) => c.name === "start_time");
                  const hasEnd = columns.some((c) => c.name === "end_time");
                  if (!hasStart)
                    this.db.run(
                      `ALTER TABLE leave_requests ADD COLUMN start_time TEXT`
                    );
                  if (!hasEnd)
                    this.db.run(
                      `ALTER TABLE leave_requests ADD COLUMN end_time TEXT`
                    );
                }
              }
            );
          }
        }
      );

      // Fleet vehicles
      this.db.run(`
        CREATE TABLE IF NOT EXISTS fleet_vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_plate TEXT NOT NULL,
          truck_type TEXT,
          km REAL DEFAULT 0,
          apk_due_date TEXT,
          rit_number TEXT,
          company_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `);

      // UI Menu configuration (for dynamic labels & ordering)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS ui_menu (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          page_key TEXT UNIQUE NOT NULL,
          label TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          visible INTEGER DEFAULT 1
        )
      `,
        (err) => {
          if (!err) {
            // Seed defaults if table empty
            this.db.get(
              `SELECT COUNT(*) AS cnt FROM ui_menu`,
              [],
              (err, row) => {
                if (!err && row && row.cnt === 0) {
                  const defaults = [
                    { k: "dashboard", l: "Dashboard" },
                    { k: "history", l: "History" },
                    { k: "weekly-hours", l: "Weekly Hours" },
                    { k: "leave", l: "Verlof" },
                    { k: "invoices", l: "Invoices" },
                    { k: "revenue", l: "Omzet" },
                    { k: "admin", l: "Admin" },
                  ];
                  const stmt = this.db.prepare(
                    `INSERT INTO ui_menu (page_key, label, sort_order, visible) VALUES (?, ?, ?, ?)`
                  );
                  defaults.forEach((d, i) => {
                    stmt.run(d.k, d.l, i, 1);
                  });
                  stmt.finalize();
                  console.log("✓ Seeded ui_menu defaults");
                }
              }
            );
          }
        }
      );

      // Translations table (for i18n)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS translations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          namespace TEXT NOT NULL,
          key TEXT NOT NULL,
          locale TEXT NOT NULL,
          text TEXT NOT NULL,
          updated_by INTEGER,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(namespace, key, locale)
        )
      `,
        (err) => {
          if (!err) {
            // Seed menu translations from existing ui_menu entries if empty
            this.db.get(
              `SELECT COUNT(*) AS cnt FROM translations`,
              [],
              (err, row) => {
                if (!err && row && row.cnt === 0) {
                  this.db.all(
                    `SELECT page_key, label FROM ui_menu`,
                    [],
                    (err, rows) => {
                      if (!err && rows && rows.length > 0) {
                        const stmt = this.db.prepare(
                          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`
                        );
                        rows.forEach((r) => {
                          // Seed english, dutch and german with the current label as a safe default
                          stmt.run("menu", r.page_key, "en", r.label);
                          stmt.run("menu", r.page_key, "nl", r.label);
                          stmt.run("menu", r.page_key, "de", r.label);
                        });
                        stmt.finalize();
                        console.log("✓ Seeded menu translations (en,nl,de)");
                        // Seed a few UI labels used in admin menu editor
                        const uiStmt = this.db.prepare(
                          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`
                        );
                        const uiLabels = [
                          ["ui", "menu.page_key", "en", "Page Key"],
                          ["ui", "menu.page_key", "nl", "Pagina sleutel"],
                          ["ui", "menu.page_key", "de", "Seiten-Schlüssel"],
                          ["ui", "menu.label", "en", "Label"],
                          ["ui", "menu.label", "nl", "Label"],
                          ["ui", "menu.label", "de", "Beschriftung"],
                          ["ui", "menu.visible", "en", "Visible"],
                          ["ui", "menu.visible", "nl", "Zichtbaar"],
                          ["ui", "menu.visible", "de", "Sichtbar"],
                          // Admin submenu translations
                          ["menu", "admin-users", "en", "Users"],
                          ["menu", "admin-users", "nl", "Gebruikers"],
                          ["menu", "admin-users", "de", "Benutzer"],
                          ["menu", "admin-companies", "en", "Companies"],
                          ["menu", "admin-companies", "nl", "Bedrijven"],
                          ["menu", "admin-companies", "de", "Unternehmen"],
                          ["menu", "admin-submissions", "en", "Submissions"],
                          ["menu", "admin-submissions", "nl", "Inzendingen"],
                          ["menu", "admin-submissions", "de", "Einreichungen"],
                          ["menu", "admin-hours-report", "en", "Hours Report"],
                          ["menu", "admin-hours-report", "nl", "Uren rapport"],
                          [
                            "menu",
                            "admin-hours-report",
                            "de",
                            "Stundenrapport",
                          ],
                          ["menu", "admin-leave", "en", "Leave Management"],
                          ["menu", "admin-leave", "nl", "Verlofsysteem"],
                          ["menu", "admin-leave", "de", "Urlaubsverwaltung"],
                          ["menu", "admin-fleet", "en", "Fleet"],
                          ["menu", "admin-fleet", "nl", "Wagenpark"],
                          ["menu", "admin-fleet", "de", "Fuhrpark"],
                          ["menu", "admin-planning", "en", "Planning"],
                          ["menu", "admin-planning", "nl", "Planning"],
                          ["menu", "admin-planning", "de", "Planung"],
                          ["menu", "admin-smtp", "en", "SMTP"],
                          ["menu", "admin-smtp", "nl", "SMTP"],
                          ["menu", "admin-smtp", "de", "SMTP"],
                          ["menu", "admin-branding", "en", "Branding"],
                          ["menu", "admin-branding", "nl", "Branding"],
                          ["menu", "admin-branding", "de", "Branding"],
                          ["menu", "admin-menu", "en", "Menu"],
                          ["menu", "admin-menu", "nl", "Menu"],
                          ["menu", "admin-menu", "de", "Menü"],
                          ["menu", "admin-translations", "en", "Translations"],
                          ["menu", "admin-translations", "nl", "Vertalingen"],
                          ["menu", "admin-translations", "de", "Übersetzungen"],
                        ];
                        uiLabels.forEach((u) =>
                          uiStmt.run(u[0], u[1], u[2], u[3])
                        );
                        uiStmt.finalize();
                        console.log(
                          "✓ Seeded UI label translations (en,nl,de)"
                        );

                        // Seed invoice import template UI labels
                        const invStmt = this.db.prepare(
                          `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES (?, ?, ?, ?)`
                        );
                        const invLabels = [
                          ["ui", "invoice.import_template_created", "nl", "Import template aangemaakt"],
                          ["ui", "invoice.import_template_created", "en", "Import template created"],
                          ["ui", "invoice.import_template_created", "de", "Importvorlage erstellt"],
                          ["ui", "invoice.import_template_deleted", "nl", "Template verwijderd"],
                          ["ui", "invoice.import_template_deleted", "en", "Template deleted"],
                          ["ui", "invoice.import_template_deleted", "de", "Vorlage gelöscht"],
                          ["ui", "invoice.import_template_delete_confirm", "nl", "Weet je zeker dat je dit import template wilt verwijderen?"],
                          ["ui", "invoice.import_template_delete_confirm", "en", "Are you sure you want to delete this import template?"],
                          ["ui", "invoice.import_template_delete_confirm", "de", "Möchten Sie diese Importvorlage wirklich löschen?"],
                          ["ui", "invoice.import_template_cleanup_confirm", "nl", "Niet-gebruikte import templates verwijderen?"],
                          ["ui", "invoice.import_template_cleanup_confirm", "en", "Delete unused import templates?"],
                          ["ui", "invoice.import_template_cleanup_confirm", "de", "Unbenutzte Importvorlagen löschen?"],
                          ["ui", "invoice.import_templates_deleted", "nl", "templates verwijderd"],
                          ["ui", "invoice.import_templates_deleted", "en", "templates deleted"],
                          ["ui", "invoice.import_templates_deleted", "de", "Vorlagen gelöscht"],
                          ["ui", "invoice.no_unused_import_templates", "nl", "Geen niet-gebruikte import templates gevonden"],
                          ["ui", "invoice.no_unused_import_templates", "en", "No unused import templates found"],
                          ["ui", "invoice.no_unused_import_templates", "de", "Keine unbenutzten Importvorlagen gefunden"],
                          ["ui", "invoice.import_template_cleanup_failed", "nl", "Opschonen mislukt"],
                          ["ui", "invoice.import_template_cleanup_failed", "en", "Cleanup failed"],
                          ["ui", "invoice.import_template_cleanup_failed", "de", "Bereinigung fehlgeschlagen"],
                        ];
                        invLabels.forEach((u) => invStmt.run(u[0], u[1], u[2], u[3]));
                        invStmt.finalize();
                        console.log("✓ Seeded invoice import template label translations");
                      }
                    }
                  );
                }
              }
            );

            // Ensure menu translations exist for all locales (non-destructive)
            this.db.all(
              `SELECT page_key, label FROM ui_menu`,
              [],
              (err2, rows) => {
                if (err2 || !rows) return;
                const locales = ["en", "nl", "de"];
                const stmt = this.db.prepare(
                  `INSERT OR IGNORE INTO translations (namespace, key, locale, text) VALUES ('menu', ?, ?, ?)`
                );
                rows.forEach((r) => {
                  locales.forEach((loc) => {
                    stmt.run(r.page_key, loc, r.label);
                  });
                });
                stmt.finalize();
              }
            );
          }
        }
      );

      // Translation import logs
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS translation_imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          admin_user_id INTEGER,
          filename TEXT,
          total_rows INTEGER,
          inserted INTEGER,
          updated INTEGER,
          invalid INTEGER,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (!err) {
            console.log("✓ Ensured translation_imports table exists");
          }
        }
      );

      // Ensure truck_type column exists on older DBs
      this.db.all(`PRAGMA table_info(fleet_vehicles)`, [], (err, columns) => {
        if (!err && columns) {
          const hasTruckType = columns.some((c) => c.name === "truck_type");
          if (!hasTruckType) {
            this.db.run(
              `ALTER TABLE fleet_vehicles ADD COLUMN truck_type TEXT`,
              (err) => {
                if (err)
                  console.error(
                    "Error adding truck_type to fleet_vehicles:",
                    err.message
                  );
                else console.log("✓ Added truck_type column to fleet_vehicles");
              }
            );
          }
        }
      });

      // Fleet maintenance
      this.db.run(`
        CREATE TABLE IF NOT EXISTS fleet_maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          maintenance_date TEXT NOT NULL,
          km REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE
        )
      `);

      // User Companies junction
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS user_companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          is_primary INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, company_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        )
      `,
        (err) => {
          if (!err) {
            this.db.all(
              `SELECT id, company_id FROM users WHERE company_id IS NOT NULL AND company_id > 0`,
              [],
              (err, rows) => {
                if (!err && rows && rows.length > 0) {
                  rows.forEach((user) => {
                    this.db.run(
                      `INSERT OR IGNORE INTO user_companies (user_id, company_id, is_primary) VALUES (?, ?, 1)`,
                      [user.id, user.company_id],
                      (err) => {
                        if (!err) {
                          console.log(
                            `✓ Migrated user ${user.id} company assignment to user_companies`
                          );
                        }
                      }
                    );
                  });
                }
              }
            );
          }
        }
      );

      // Vehicles (used by planning and vehicles routes)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          license_plate TEXT NOT NULL UNIQUE,
          route_number TEXT,
          company_id INTEGER,
          current_km REAL DEFAULT 0,
          apk_date TEXT,
          chassis_number TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicle_maintenance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          maintenance_date TEXT NOT NULL,
          km_at_maintenance REAL NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS vehicle_apk_alerts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL UNIQUE,
          alert_one_month INTEGER DEFAULT 1,
          alert_two_weeks INTEGER DEFAULT 1,
          alert_email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
        )
      `);

      // Planning schedules
      this.db.run(`
        CREATE TABLE IF NOT EXISTS planning_schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          week_number INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL,
          route_number TEXT NOT NULL,
          driver_id INTEGER NOT NULL,
          vehicle_id INTEGER,
          company_id INTEGER NOT NULL,
          adr INTEGER DEFAULT 0,
          mega_kast TEXT DEFAULT 'only_mega',
          phone_number TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
          FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
        )
      `);

      // SMTP settings
      this.db.run(`
        CREATE TABLE IF NOT EXISTS smtp_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          smtp_host TEXT,
          smtp_port INTEGER,
          smtp_secure INTEGER DEFAULT 0,
          smtp_user TEXT,
          smtp_pass TEXT,
          email_from TEXT,
          email_to TEXT,
          auth_type TEXT DEFAULT 'basic',
          oauth_tenant_id TEXT,
          oauth_client_id TEXT,
          oauth_client_secret TEXT,
          oauth_scope TEXT DEFAULT 'https://outlook.office365.com/.default',
          signature_enabled INTEGER DEFAULT 0,
          signature_html TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure signature columns exist on smtp_settings
      this.db.all(`PRAGMA table_info(smtp_settings)`, [], (err, columns) => {
        if (!err && Array.isArray(columns)) {
          const names = columns.map((c) => c.name);
          const ensure = (name, sql) => {
            if (!names.includes(name)) {
              this.db.run(sql, (e) => {
                if (e) console.error(`Failed to add column ${name} to smtp_settings:`, e.message);
              });
            }
          };
          ensure(
            "signature_enabled",
            "ALTER TABLE smtp_settings ADD COLUMN signature_enabled INTEGER DEFAULT 0"
          );
          ensure(
            "signature_html",
            "ALTER TABLE smtp_settings ADD COLUMN signature_html TEXT"
          );
        }
      });

      // Branding settings (used by public branding endpoint and PDFs)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS branding_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_name TEXT,
          primary_color TEXT,
          logo_path TEXT,
          tagline TEXT,
          custom_css TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (!err) {
            // Check if tagline column exists, if not add it
            this.db.all(
              `PRAGMA table_info(branding_settings)`,
              [],
              (err, columns) => {
                if (!err && columns) {
                  const ensure = (name, sql) => {
                    if (!columns.some((c) => c.name === name)) {
                      this.db.run(sql);
                    }
                  };
                  ensure(
                    "tagline",
                    "ALTER TABLE branding_settings ADD COLUMN tagline TEXT"
                  );
                  ensure(
                    "custom_css",
                    "ALTER TABLE branding_settings ADD COLUMN custom_css TEXT"
                  );
                }
              }
            );
          }
        }
      );

      // Invoice templates
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          hourly_rate REAL DEFAULT 0,
          km_rate REAL DEFAULT 0,
          dot_rate REAL DEFAULT 0,
          dot_rate_is_percent INTEGER DEFAULT 0,
          default_font_family TEXT DEFAULT 'Helvetica',
          table_header_bg TEXT DEFAULT '#0080ff',
          table_header_text TEXT DEFAULT '#ffffff',
          table_row_bg1 TEXT DEFAULT '#f4f8ff',
          table_row_bg2 TEXT DEFAULT '#e7f2ff',
          table_border_color TEXT DEFAULT '#c7ddff',
          table_text_color TEXT DEFAULT '#000000',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add hourly_rate and km_rate columns if they don't exist
      this.db.all(
        `PRAGMA table_info(invoice_templates)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("hourly_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN hourly_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding hourly_rate:", err);
                  } else {
                    console.log(
                      "✓ Added hourly_rate column to invoice_templates"
                    );
                  }
                }
              );
            }
            if (!columnNames.includes("km_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN km_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding km_rate:", err);
                  } else {
                    console.log("✓ Added km_rate column to invoice_templates");
                  }
                }
              );
            }
            if (!columnNames.includes("dot_rate")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN dot_rate REAL DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding dot_rate:", err);
                  } else {
                    console.log("✓ Added dot_rate column to invoice_templates");
                  }
                }
              );
            }
            if (!columnNames.includes("dot_rate_is_percent")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN dot_rate_is_percent INTEGER DEFAULT 0",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding dot_rate_is_percent:", err);
                  } else {
                    console.log(
                      "✓ Added dot_rate_is_percent column to invoice_templates"
                    );
                  }
                }
              );
            }
            if (!columnNames.includes("default_font_family")) {
              this.db.run(
                "ALTER TABLE invoice_templates ADD COLUMN default_font_family TEXT DEFAULT 'Helvetica'",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding default_font_family:", err);
                  } else {
                    console.log(
                      "✓ Added default_font_family column to invoice_templates"
                    );
                  }
                }
              );
            }
            const ensureColor = (name, defaultValue) => {
              if (!columnNames.includes(name)) {
                this.db.run(
                  `ALTER TABLE invoice_templates ADD COLUMN ${name} TEXT DEFAULT '${defaultValue}'`,
                  (err) => {
                    if (err && !err.message.includes("duplicate column")) {
                      console.error(`Error adding ${name}:`, err);
                    } else {
                      console.log(`✓ Added ${name} column to invoice_templates`);
                    }
                  }
                );
              }
            };
            ensureColor("table_header_bg", "#0080ff");
            ensureColor("table_header_text", "#ffffff");
            ensureColor("table_row_bg1", "#f4f8ff");
            ensureColor("table_row_bg2", "#e7f2ff");
            ensureColor("table_border_color", "#c7ddff");
            ensureColor("table_text_color", "#000000");
          }
        }
      );

      // Invoice template elements (text fields, images, calculated fields)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_template_elements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          element_type TEXT NOT NULL,
          label TEXT,
          content TEXT,
          image_path TEXT,
          position_order INTEGER DEFAULT 0,
          image_align TEXT DEFAULT 'left',
          image_width INTEGER DEFAULT 150,
          image_height INTEGER DEFAULT 0,
          font_size INTEGER DEFAULT 14,
          font_color TEXT DEFAULT '#000000',
          font_weight TEXT DEFAULT 'normal',
          font_family TEXT,
          calculation_formula TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE CASCADE
        )
      `);

      // Uploaded fonts library
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_fonts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          family TEXT NOT NULL,
          weight TEXT CHECK(weight IN ('normal','bold')) DEFAULT 'normal',
          file_path TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure new column font_family exists on invoice_template_elements
      this.db.all(
        `PRAGMA table_info(invoice_template_elements)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const names = columns.map((c) => c.name);
            if (!names.includes("font_family")) {
              this.db.run(
                "ALTER TABLE invoice_template_elements ADD COLUMN font_family TEXT",
                (err) => {
                  if (err && !err.message.includes("duplicate column")) {
                    console.error("Error adding font_family to elements:", err);
                  } else {
                    console.log("✓ Added font_family column to invoice_template_elements");
                  }
                }
              );
            }
          }
        }
      );

      this.db.all(
        `PRAGMA table_info(invoice_template_elements)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);

            if (!columnNames.includes("image_align")) {
              this.db.run(
                "ALTER TABLE invoice_template_elements ADD COLUMN image_align TEXT DEFAULT 'left'",
                (alterErr) => {
                  if (alterErr && !alterErr.message.includes("duplicate column")) {
                    console.error("Error adding image_align to invoice_template_elements:", alterErr);
                  } else {
                    console.log(
                      "✓ Added image_align column to invoice_template_elements"
                    );
                  }
                }
              );
            }

            if (!columnNames.includes("image_width")) {
              this.db.run(
                "ALTER TABLE invoice_template_elements ADD COLUMN image_width INTEGER DEFAULT 150",
                (alterErr) => {
                  if (alterErr && !alterErr.message.includes("duplicate column")) {
                    console.error("Error adding image_width to invoice_template_elements:", alterErr);
                  } else {
                    console.log(
                      "✓ Added image_width column to invoice_template_elements"
                    );
                  }
                }
              );
            }

            if (!columnNames.includes("image_height")) {
              this.db.run(
                "ALTER TABLE invoice_template_elements ADD COLUMN image_height INTEGER DEFAULT 0",
                (alterErr) => {
                  if (alterErr && !alterErr.message.includes("duplicate column")) {
                    console.error("Error adding image_height to invoice_template_elements:", alterErr);
                  } else {
                    console.log(
                      "✓ Added image_height column to invoice_template_elements"
                    );
                  }
                }
              );
            }

            if (!columnNames.includes("text_align_h")) {
              this.db.run(
                "ALTER TABLE invoice_template_elements ADD COLUMN text_align_h TEXT DEFAULT 'left'",
                (alterErr) => {
                  if (alterErr && !alterErr.message.includes("duplicate column")) {
                    console.error("Error adding text_align_h to invoice_template_elements:", alterErr);
                  } else {
                    console.log(
                      "✓ Added text_align_h column to invoice_template_elements"
                    );
                  }
                }
              );
            }
          }
        }
      );

      // Import templates (for PDF extraction parsers)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS import_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          parser_type TEXT NOT NULL,
          config TEXT,
          sample_pdf_path TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Ensure sample_pdf_path exists on import_templates
      this.db.all(`PRAGMA table_info(import_templates)`, [], (err, columns) => {
        if (
          !err &&
          columns &&
          !columns.some((c) => c.name === "sample_pdf_path")
        ) {
          this.db.run(
            `ALTER TABLE import_templates ADD COLUMN sample_pdf_path TEXT`,
            (alterErr) => {
              if (alterErr) {
                console.error(
                  "Error adding sample_pdf_path to import_templates:",
                  alterErr
                );
              } else {
                console.log(
                  "✓ Added sample_pdf_path column to import_templates"
                );
              }
            }
          );
        }
      });

      // Template field mappings to guide AI extraction (regex/keyword per template)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS template_field_mappings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          field_key TEXT NOT NULL,
          pattern TEXT,
          page INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(template_id, field_key),
          FOREIGN KEY (template_id) REFERENCES import_templates(id) ON DELETE CASCADE
        )
      `);

      // Invoices (generated invoices from templates)
      this.db.run(
        `
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          invoice_number TEXT NOT NULL UNIQUE,
          customer_name TEXT,
          customer_address TEXT,
          invoice_date TEXT NOT NULL,
          due_date TEXT,
          subtotal REAL DEFAULT 0,
          vat_amount REAL DEFAULT 0,
          total_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','cancelled')),
          notes TEXT,
          original_pdf_path TEXT,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE RESTRICT,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `,
        (err) => {
          if (!err) {
            // Check if original_pdf_path column exists, add if not
            this.db.all("PRAGMA table_info(invoices)", [], (err, columns) => {
              if (!err && columns) {
                const hasPdfPath = columns.some(
                  (c) => c.name === "original_pdf_path"
                );
                if (!hasPdfPath) {
                  this.db.run(
                    "ALTER TABLE invoices ADD COLUMN original_pdf_path TEXT",
                    (err) => {
                      if (err)
                        console.error(
                          "Error adding original_pdf_path column:",
                          err
                        );
                      else
                        console.log(
                          "✓ Added original_pdf_path column to invoices"
                        );
                    }
                  );
                }
                
                // Check if invoice_type column exists, add if not
                const hasInvoiceType = columns.some(
                  (c) => c.name === "invoice_type"
                );
                if (!hasInvoiceType) {
                  this.db.run(
                    "ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'Verkoop' CHECK(invoice_type IN ('Inkoop','Verkoop'))",
                    (err) => {
                      if (err) {
                        console.error(
                          "Error adding invoice_type column:",
                          err
                        );
                      } else {
                        console.log(
                          "✓ Added invoice_type column to invoices"
                        );
                        // Set existing invoices to 'Verkoop'
                        this.db.run(
                          "UPDATE invoices SET invoice_type = 'Verkoop' WHERE invoice_type IS NULL",
                          (updateErr) => {
                            if (updateErr) {
                              console.error("Error setting default invoice_type:", updateErr);
                            } else {
                              console.log("✓ Set existing invoices to 'Verkoop'");
                            }
                          }
                        );
                      }
                    }
                  );
                }
              }
            });
          }
        }
      );

      // Invoice line items (individual lines in an invoice)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_line_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          unit_price REAL DEFAULT 0,
          line_total REAL DEFAULT 0,
          position_order INTEGER DEFAULT 0,
          item_date TEXT,
          item_km REAL,
          item_hours REAL,
          item_rate REAL,
          is_total_row INTEGER DEFAULT 0,
          total_row_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        )
      `);

      // Ensure new columns exist on existing invoice_line_items
      this.db.all(
        `PRAGMA table_info(invoice_line_items)`,
        [],
        (err, columns) => {
          if (!err && columns) {
            const columnNames = columns.map((c) => c.name);
            if (!columnNames.includes("item_date")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_date TEXT`
              );
            }
            if (!columnNames.includes("item_km")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_km REAL`
              );
            }
            if (!columnNames.includes("item_hours")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_hours REAL`
              );
            }
            if (!columnNames.includes("item_rate")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN item_rate REAL`
              );
            }
            if (!columnNames.includes("is_total_row")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN is_total_row INTEGER DEFAULT 0`
              );
            }
            if (!columnNames.includes("total_row_type")) {
              this.db.run(
                `ALTER TABLE invoice_line_items ADD COLUMN total_row_type TEXT`
              );
            }
          }
        }
      );

      // Invoice template line item field configuration
      this.db.run(`
        CREATE TABLE IF NOT EXISTS invoice_template_line_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          field_label TEXT,
          is_visible INTEGER DEFAULT 1,
          position_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(template_id, field_name),
          FOREIGN KEY (template_id) REFERENCES invoice_templates(id) ON DELETE CASCADE
        )
      `);
    });
  }

  // Generic query methods
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();
