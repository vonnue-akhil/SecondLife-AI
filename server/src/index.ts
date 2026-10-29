import { env } from './config';
import { createApp } from './app';

createApp().listen(env.PORT, () => {
  console.log(`SecondLife AI server listening on http://localhost:${env.PORT}`);
});
