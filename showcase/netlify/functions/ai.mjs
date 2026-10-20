import { getUser } from '@netlify/identity';
import { handle } from '../handler.mjs';
export default async req => handle(req,getUser);
export const config = { rateLimit:{action:'rate_limit',aggregateBy:['domain','ip'],windowSize:60,windowLimit:6} };
