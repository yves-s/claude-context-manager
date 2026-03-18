# Credentials — Verweise

> ⚠️ **Keine Secrets in dieser Datei!**
> Hier stehen nur Verweise auf den tatsächlichen Speicherort von API-Keys und Zugangsdaten.

## API-Zugänge

<!-- Beispiel:
| System | Key-Typ | Speicherort | Env-Variable |
|--------|---------|-------------|--------------|
| EasyBill | API Key | 1Password → Vault "Engineering" → "EasyBill Prod" | `EASYBILL_API_KEY` |
| Shopify | Access Token | 1Password → Vault "Engineering" → "Shopify Admin" | `SHOPIFY_ACCESS_TOKEN` |
| Notion | Integration Token | 1Password → Vault "Engineering" → "Notion Integration" | `NOTION_TOKEN` |
-->

| System | Key-Typ | Speicherort | Env-Variable |
|--------|---------|-------------|--------------|
| _Noch keine Zugänge konfiguriert_ | | | |

## Lokales Setup

Für die lokale Entwicklung: `.env`-Datei im jeweiligen Sub-Repo anlegen (ist in `.gitignore`).

```bash
# .env (Beispiel)
EASYBILL_API_KEY=xxx
SHOPIFY_ACCESS_TOKEN=xxx
NOTION_TOKEN=xxx
```

## Hinweise

- `.env`-Dateien werden **nie** committed oder gesynced
- Bei Team-Arbeit: Neue Teammitglieder bekommen Zugänge über 1Password/Vault
- Bei Key-Rotation: Verweis hier aktualisieren, Keys im Vault rotieren
