import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createAppServices, type AppServices } from '@composition/container';

const ServicesContext = createContext<AppServices | null>(null);

/** 합성 루트에서 만든 서비스를 트리 전체에 제공한다. (테스트에서는 services를 직접 주입) */
export function ServicesProvider({
  children,
  services,
}: {
  children: ReactNode;
  services?: AppServices;
}) {
  const value = useMemo(() => services ?? createAppServices(), [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices는 ServicesProvider 안에서만 사용할 수 있어요.');
  return ctx;
}
