export type LocalData = {
  id: string;
  label: string;
  value: string;
  category: string | null;
  createdAt: string | null;
};

export type TwoFactorCode = {
  id: string;
  serviceName: string;
  secret: string;
  issuer: string | null;
  createdAt: string | null;
};
