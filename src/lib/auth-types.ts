export type AppRole = "external" | "sales_rep" | "estimator" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | null;
};
