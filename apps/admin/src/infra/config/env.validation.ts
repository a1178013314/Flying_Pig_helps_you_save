import Joi from "joi";

/** fail-fast：NODE_ENV 缺失或非法，启动即终止。 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .required()
    .messages({ "any.required": "NODE_ENV 必填（development | test | production）" }),
  PORT: Joi.number().port().default(3001),
  DB_PATH: Joi.string().default("data/flypig.sqlite"),
  LOG_FILE_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
});
