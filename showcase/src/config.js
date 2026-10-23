// Public configuration. Values are injected at build time from environment variables
// (see scripts/build.mjs) and can be overridden at runtime with window.FIRECAM_CONFIG.
// Only public identifiers belong here: the Supabase anon key and the VAPID public key are
// designed to be shipped to browsers. Secrets (service role key, VAPID private key) live
// only in Netlify function environment variables.
const built=typeof __FIRECAM_CONFIG__!=='undefined'?__FIRECAM_CONFIG__:{};
export const config={supabaseUrl:'',supabaseAnonKey:'',vapidPublicKey:'',...built,...(globalThis.FIRECAM_CONFIG||{})};
export const cloudEnabled=()=>/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)&&config.supabaseAnonKey.length>20;
export const pushEnabled=()=>cloudEnabled()&&config.vapidPublicKey.length>60;
