package app.lector.recommend;

final class Matrices {

    private Matrices() {}

    static double[] solve(double[][] a, double[] b) {
        int n = b.length;
        double[][] m = new double[n][n + 1];
        for (int i = 0; i < n; i++) {
            System.arraycopy(a[i], 0, m[i], 0, n);
            m[i][n] = b[i];
        }
        eliminate(m, n);
        double[] x = new double[n];
        for (int i = 0; i < n; i++) {
            x[i] = m[i][n];
        }
        return x;
    }

    static double[][] inverse(double[][] a) {
        int n = a.length;
        double[][] m = new double[n][2 * n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(a[i], 0, m[i], 0, n);
            m[i][n + i] = 1;
        }
        eliminate(m, n);
        double[][] inv = new double[n][n];
        for (int i = 0; i < n; i++) {
            System.arraycopy(m[i], n, inv[i], 0, n);
        }
        return inv;
    }

    private static void eliminate(double[][] m, int n) {
        for (int col = 0; col < n; col++) {
            int pivot = col;
            for (int r = col + 1; r < n; r++) {
                if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) {
                    pivot = r;
                }
            }
            double[] swap = m[col];
            m[col] = m[pivot];
            m[pivot] = swap;
            double p = m[col][col];
            if (Math.abs(p) < 1e-300) {
                throw new ArithmeticException("singular matrix");
            }
            for (int c = 0; c < m[col].length; c++) {
                m[col][c] /= p;
            }
            for (int r = 0; r < n; r++) {
                double f = m[r][col];
                if (r != col && f != 0) {
                    for (int c = 0; c < m[r].length; c++) {
                        m[r][c] -= f * m[col][c];
                    }
                }
            }
        }
    }
}
