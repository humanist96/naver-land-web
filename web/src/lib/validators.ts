import { z } from 'zod/v4'

export const signupSchema = z.object({
  email: z.email('올바른 이메일을 입력해주세요.'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .max(100, '비밀번호는 100자 이하여야 합니다.'),
  name: z
    .string()
    .min(2, '이름은 2자 이상이어야 합니다.')
    .max(50, '이름은 50자 이하여야 합니다.'),
})

export const loginSchema = z.object({
  email: z.email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

export const searchRegionSchema = z.object({
  district: z.string().min(1, '지역을 선택해주세요.'),
  city: z.string().optional(),
  tradeTypes: z.string().optional(),
  propertyType: z.string().optional(),
  sizeType: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.string().optional(),
  limit: z.coerce.number().optional(),
})

export const nlqSchema = z.object({
  query: z
    .string()
    .min(2, '검색어를 2자 이상 입력해주세요.')
    .max(200, '검색어는 200자 이하여야 합니다.'),
})

export const collectionJobSchema = z.object({
  districtCode: z.string().min(1),
  districtName: z.string().min(1),
  cityName: z.string().min(1),
  tradeTypes: z.array(z.string()).min(1, '거래유형을 1개 이상 선택해주세요.'),
  propertyTypes: z.array(z.string()).min(1),
  schedule: z.string().min(1),
  isActive: z.boolean(),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SearchRegionInput = z.infer<typeof searchRegionSchema>
export type NlqInput = z.infer<typeof nlqSchema>
export type CollectionJobInput = z.infer<typeof collectionJobSchema>
