package app.lector.recommend;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Learns Explore's score weights from what learners opened: a logistic regression of "opened" on the seven unweighted
 * score parts, with the card's position on its shelf as a control term (people open what is first, whatever it is).
 * Plain, deterministic code: Newton's method with a weak ridge prior, which also keeps the fit finite when the data
 * separate perfectly. A part earns a weight only when its effect is clearly above zero (at least three standard
 * errors); a part that never varies says nothing and keeps its configured weight. Learned weights are scaled so all
 * seven add up to the configured total, keeping the "shown, never opened" penalty on the same scale.
 */
final class WeightLearner {

    /** One learner and item: the parts and position it was shown with, and whether it was opened (or read). */
    record Example(double[] parts, int position, boolean opened) {}

    static final int MIN_EXAMPLES = 200;
    static final int MIN_EACH = 20;
    static final double MIN_Z = 3;
    private static final double RIDGE = 1.0;
    private static final int ITERATIONS = 100;
    private static final double CONVERGED = 1e-9;
    private static final int PARTS = 7;

    private WeightLearner() {}

    static Optional<Weights> learn(List<Example> data, Weights configured) {
        if (!enough(data)) {
            return Optional.empty();
        }
        List<Integer> varying = varying(data);
        double[][] x = design(data, varying);
        double[] y = data.stream().mapToDouble(e -> e.opened() ? 1 : 0).toArray();
        Fit fit = fit(x, y);
        double[] base = values(configured);
        double[] learned = base.clone();
        double kept = 0;
        double earned = 0;
        for (int j = 0; j < varying.size(); j++) {
            int part = varying.get(j);
            double coefficient = fit.beta()[j + 1];
            double se = Math.sqrt(fit.variance()[j + 1]);
            learned[part] = coefficient > 0 && coefficient >= MIN_Z * se ? coefficient : 0;
            earned += learned[part];
        }
        for (int part = 0; part < PARTS; part++) {
            kept += varying.contains(part) ? 0 : base[part];
        }
        if (earned <= 0) {
            return Optional.empty();
        }
        double scale = (sum(base) - kept) / earned;
        for (int part : varying) {
            learned[part] *= scale;
        }
        return Optional.of(weights(learned));
    }

    /** At least 200 examples, with 20 or more each opened and not opened. */
    static boolean enough(List<Example> data) {
        long positives = data.stream().filter(Example::opened).count();
        return data.size() >= MIN_EXAMPLES && positives >= MIN_EACH && data.size() - positives >= MIN_EACH;
    }

    /** Parts (by index) whose value differs somewhere in the data. */
    private static List<Integer> varying(List<Example> data) {
        List<Integer> out = new ArrayList<>();
        for (int p = 0; p < PARTS; p++) {
            double first = data.getFirst().parts()[p];
            final int part = p;
            if (data.stream().anyMatch(e -> Math.abs(e.parts()[part] - first) > 1e-12)) {
                out.add(p);
            }
        }
        return out;
    }

    /** Rows of [1, the varying parts, log(1 + position)]. */
    private static double[][] design(List<Example> data, List<Integer> varying) {
        double[][] x = new double[data.size()][varying.size() + 2];
        for (int i = 0; i < data.size(); i++) {
            Example e = data.get(i);
            x[i][0] = 1;
            for (int j = 0; j < varying.size(); j++) {
                x[i][j + 1] = e.parts()[varying.get(j)];
            }
            x[i][varying.size() + 1] = Math.log1p(e.position());
        }
        return x;
    }

    /** Coefficients and their variances (the diagonal of the inverse Hessian at the optimum). */
    record Fit(double[] beta, double[] variance) {}

    static Fit fit(double[][] x, double[] y) {
        int k = x[0].length;
        double[] beta = new double[k];
        double[][] hessian = new double[k][k];
        for (int iteration = 0; iteration < ITERATIONS; iteration++) {
            double[] gradient = new double[k];
            hessian = new double[k][k];
            for (int i = 0; i < x.length; i++) {
                double p = sigmoid(dot(x[i], beta));
                double w = p * (1 - p);
                for (int a = 0; a < k; a++) {
                    gradient[a] += (y[i] - p) * x[i][a];
                    for (int b = 0; b < k; b++) {
                        hessian[a][b] += w * x[i][a] * x[i][b];
                    }
                }
            }
            for (int a = 1; a < k; a++) { // no prior on the intercept
                gradient[a] -= RIDGE * beta[a];
                hessian[a][a] += RIDGE;
            }
            double[] step = Matrices.solve(hessian, gradient);
            double largest = 0;
            for (int a = 0; a < k; a++) {
                beta[a] += step[a];
                largest = Math.max(largest, Math.abs(step[a]));
            }
            if (largest < CONVERGED) {
                break;
            }
        }
        double[][] inverse = Matrices.inverse(hessian);
        double[] variance = new double[k];
        for (int a = 0; a < k; a++) {
            variance[a] = inverse[a][a];
        }
        return new Fit(beta, variance);
    }

    private static double sigmoid(double z) {
        return 1 / (1 + Math.exp(-z));
    }

    private static double dot(double[] a, double[] b) {
        double s = 0;
        for (int i = 0; i < a.length; i++) {
            s += a[i] * b[i];
        }
        return s;
    }

    private static double sum(double[] values) {
        double s = 0;
        for (double v : values) {
            s += v;
        }
        return s;
    }

    static double[] values(Weights w) {
        return new double[] {w.interest(), w.topic(), w.comprehend(), w.level(), w.popular(), w.fresh(), w.format()};
    }

    private static Weights weights(double[] v) {
        return new Weights(v[0], v[1], v[2], v[3], v[4], v[5], v[6]);
    }
}
