# Bazaar — real local marketplace

Bazaar is a responsive, Vercel-ready marketplace frontend backed by Supabase. Unlike the uploaded demo, it does **not** seed invented products, seller names, buyer requests, or automatic chat replies. Browsing only shows listings published by registered members.

## Included features

- Email/password sign-up and sign-in, plus member profiles
- User-created listings with up to 6 actual photos per item
- Category, title/description search, area, condition, and price filters
- Newest/price sorting and paginated results
- Saved listings tied to each account
- Seller listing management: edit, mark sold, restore, or archive
- Private buyer/seller conversations stored in the database with live message updates
- Row Level Security (RLS) policies for profiles, listings, saved items, conversations, messages, reports, and photo uploads
- Responsive desktop/mobile UI and light/dark themes
- Clear empty states instead of fake starter inventory

## One-time setup

This source folder can be uploaded to GitHub and deployed on Vercel as a static site. To let real people use it, connect a Supabase project once:

1. Create a project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, run the full script `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and the public `anon` / publishable key.
4. Put those two values in `config.js`:

   ```js
   window.BAZAAR_CONFIG = {
     supabaseUrl: "https://YOUR_PROJECT.supabase.co",
     supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY"
   };
   ```

   The anon key is intended for browser use. **Never** put a `service_role` or secret key in `config.js`. Database access is protected by the RLS policies in `supabase/schema.sql`.

5. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed Vercel URL and add that URL to the allowed redirect URLs. For a public marketplace, decide whether you want email confirmation enabled before members can sign in.
6. Deploy the root folder on Vercel. `index.html`, `styles.css`, `app.js`, `config.js`, `vercel.json`, and `supabase/schema.sql` should remain at the project root / included path as supplied.

## Important behavior

- There are intentionally no pretend listings. The browse page stays empty until a real member publishes an item.
- Each listing requires at least one image selected by its seller. Photos go into the public `listing-photos` bucket because public listings need public images; only authenticated users can upload into their own user-ID folder.
- Conversations and messages are visible only to the buyer and seller who are participants.
- The app does not take payments or promise shipping. Members arrange payment and safe local meetups themselves.
- Public profiles show the member's chosen display name and area. Encourage users not to publish a home address or personal contact information.

## Local preview

Because the app imports Supabase's browser client from a CDN, preview it through a local web server rather than opening `index.html` as a `file://` URL. For example, with Python installed:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`. With empty values in `config.js`, the app displays the real-backend setup screen rather than pretending to be populated.
