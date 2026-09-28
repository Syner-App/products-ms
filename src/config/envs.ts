import 'dotenv/config';

import Joi from 'joi';

interface EnvVars {
    PORT: number;
}

const envsSchema = Joi.object({
    PORT: Joi.number().required()
}).unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) {
     throw new Error(`Config validation error: ${ error }`);
}

const envVars: EnvVars = value;

export const envs = {
    port: envVars.PORT
}