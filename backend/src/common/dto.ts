import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Forms send "" for an empty box and the services store null; these decorators make an empty or
// whitespace-only value count as "not given" before validation runs.
const emptyToUndefined = Transform(({ value }) => (typeof value === 'string' && !value.trim() ? undefined : value));
const trim = Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Required text, trimmed. */
export const Text = (max = 200) => applyDecorators(trim, IsString(), MinLength(1, { message: 'Không được để trống' }), MaxLength(max));

/** Optional text, trimmed; "" becomes undefined. */
export const OptionalText = (max = 500) => applyDecorators(emptyToUndefined, trim, IsOptional(), IsString(), MaxLength(max));

/** Optional e-mail; "" becomes undefined. */
export const OptionalEmail = () => applyDecorators(emptyToUndefined, trim, IsOptional(), IsEmail({}, { message: 'Email không hợp lệ' }));

/** Optional "YYYY-MM-DD" (a @db.Date column); "" becomes undefined. */
export const OptionalDay = () =>
  applyDecorators(emptyToUndefined, IsOptional(), Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }));
