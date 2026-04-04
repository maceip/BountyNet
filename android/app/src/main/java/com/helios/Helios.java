package com.helios;

/**
 * JNI surface for {@code libhelios}, matching the flapigen output used by
 * <a href="https://github.com/cawfree/react-native-helios">react-native-helios</a>.
 * <p>
 * After running {@code yarn heliosup} in that repo, replace this file with the generated
 * {@code Helios.java} if your native symbols differ. Copy {@code libhelios.so} into
 * {@code app/src/main/jniLibs/&lt;abi&gt;/}.
 */
public final class Helios {

    private static volatile boolean libraryLoaded;

    /** @return false if {@code libhelios} is not packaged for this ABI */
    public static boolean loadLibrary() {
        if (libraryLoaded) return true;
        synchronized (Helios.class) {
            if (libraryLoaded) return true;
            try {
                System.loadLibrary("helios");
                libraryLoaded = true;
                return true;
            } catch (UnsatisfiedLinkError ignored) {
                return false;
            }
        }
    }

    public native void heliosStart(
            String untrustedRpcUrl,
            String consensusRpcUrl,
            double rpcPort,
            String network,
            String dataDir,
            String checkpoint
    );

    public native void heliosShutdown();

    public native String heliosFallbackCheckpoint(String network);
}
