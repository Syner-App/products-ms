import 'dotenv/config';

import Joi from 'joi';

interface EnvVars {
    PORT: number;
    DATABASE_URL: string;
    RABBITMQ_URL: string;
}

const envsSchema = Joi.object({
    PORT: Joi.number().required(),
    DATABASE_URL: Joi.string().required(),
    RABBITMQ_URL: Joi.string().required(),
}).unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) {
     throw new Error(`Config validation error: ${ error }`);
}

const envVars: EnvVars = value;

export const envs = {
    port: envVars.PORT,
    databaseUrl: envVars.DATABASE_URL,
    rabbitmqUrl: envVars.RABBITMQ_URL,
}
