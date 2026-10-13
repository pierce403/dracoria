import {Container} from '@cloudflare/containers';
export class LegacyDracoria extends Container {
  defaultPort=3000;
  sleepAfter='2m';
  constructor(ctx,env){
    super(ctx,env);
    const staging=env.STAGING==='true';
    this.enableInternet=!staging;
    this.envVars={
      NODE_ENV:'production',PORT:'3000',CLOUDFLARE:'true',EXTERNAL_SCHEDULER:'true',
      FIXTURE_MODE:staging?'true':'false',
      MIGRATION_READ_ONLY:env.READ_ONLY,
      DATABASE_URL:staging?'mongodb://127.0.0.1:27017/dracoria_staging':env.DATABASE_URL,
      SESSION_SECRET:env.SESSION_SECRET,
      OPENAI_API_KEY:staging?'isolated-staging-key':env.OPENAI_API_KEY,
      ...(staging?{OPENAI_BASE_URL:'http://127.0.0.1:3002/v1'}:{}),
    };
  }
  onError(){console.error('Legacy Dracoria container error');}
}
export {default} from './router.mjs';
