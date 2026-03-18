from __future__ import annotations

from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

from routes.performance_routes import performance_bp, analyzer

app = Flask(__name__)
CORS(app)
app.register_blueprint(performance_bp)


@app.route("/", methods=["GET"])
def home():
    return jsonify(
        {
            "service": "Campus Connect ML API",
            "version": "2.0.0",
            "status": "running",
            "timestamp": datetime.now().isoformat(),
            "endpoints": {
                "predict": "POST /predict",
                "batch_predict": "POST /batch-predict",
                "health": "GET /health",
                "model_info": "GET /model-info",
                "performance_api": "GET /api/ml/performance/health",
            },
        }
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@app.route("/predict", methods=["POST"])
def predict_single():
    """Compatibility endpoint consumed by Node /api/ml routes."""
    try:
        data = request.get_json() or {}
        perf = analyzer.calculate_individual_performance(data)
        prediction = {
            "predictedCGPA": round(float(data.get("cgpa", 0) or 0) * 0.7 + perf["subject_performance_score"] / 20, 2),
            "placementProbability": perf["placement_probability"],
            "riskCategory": perf["risk_level"].replace(" Risk", ""),
            "recommendations": perf["recommendations"],
            "confidence": 0.82,
        }
        return jsonify(prediction)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    try:
        payload = request.get_json() or {}
        students = payload.get("students", [])
        if not students:
            return jsonify({"error": "No student data provided"}), 400

        predictions = []
        for s in students:
            perf = analyzer.calculate_individual_performance(s)
            predictions.append(
                {
                    "prn": s.get("prn"),
                    "prediction": {
                        "predictedCGPA": round(float(s.get("cgpa", 0) or 0) * 0.7 + perf["subject_performance_score"] / 20, 2),
                        "placementProbability": perf["placement_probability"],
                        "riskCategory": perf["risk_level"].replace(" Risk", ""),
                        "recommendations": perf["recommendations"],
                        "confidence": 0.82,
                    },
                }
            )

        return jsonify(
            {
                "success": True,
                "total": len(predictions),
                "predictions": predictions,
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/train", methods=["POST"])
def train_placeholder():
    """Compatibility endpoint retained for old admin UI.
    Use /api/ml/performance/train-db for real training.
    """
    return jsonify(
        {
            "success": True,
            "message": "Use /api/ml/performance/train-db with database students payload for training",
            "status": "ready",
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/model-info", methods=["GET"])
def model_info_compat():
    return jsonify(
        {
            "modelType": "RandomForestClassifier",
            "version": "2.0.0",
            "features": analyzer.feature_columns,
            "accuracy": (analyzer.metrics.get("accuracy", 0) * 100) if analyzer.metrics else 0,
            "lastTrained": analyzer.last_trained,
            "trained": analyzer.is_trained,
            "metrics": analyzer.metrics,
            "featureImportance": analyzer.feature_importance,
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
