import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_GATEWAY,
  loadGatewayBase,
  persistGatewayBase,
} from "@/lib/gateway";

type GatewayContextValue = {
  gatewayBase: string;
  setGatewayBase: (next: string) => void;
};

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [gatewayBase, setGb] = useState(loadGatewayBase);
  const setGatewayBase = useCallback((next: string) => {
    setGb(next);
    persistGatewayBase(next);
  }, []);
  const v = useMemo(
    () => ({ gatewayBase, setGatewayBase }),
    [gatewayBase, setGatewayBase],
  );
  return (
    <GatewayContext.Provider value={v}>{children}</GatewayContext.Provider>
  );
}

// Provider + hook in one module is intentional for this small app shell.
// eslint-disable-next-line react-refresh/only-export-components
export function useGateway() {
  const v = useContext(GatewayContext);
  if (!v) {
    return {
      gatewayBase: DEFAULT_GATEWAY,
      setGatewayBase: () => {},
    };
  }
  return v;
}
