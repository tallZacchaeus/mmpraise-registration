import { z } from 'zod'
import { emailSchema, nameSchema, passwordSchema, usernameSchema } from './common'

/** Account creation — the first step of registration. */
export const signUpSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: 'You must accept the volunteer terms to continue' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => !data.password.toLowerCase().includes(data.username.toLowerCase()), {
    message: 'Password must not contain your username',
    path: ['password'],
  })

export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  identifier: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.string().min(3, 'Enter your email address or username').max(254)),
  password: z.string().min(1, 'Enter your password'),
  redirectTo: z.string().optional(),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: 'Choose a password different from your current one',
    path: ['password'],
  })
