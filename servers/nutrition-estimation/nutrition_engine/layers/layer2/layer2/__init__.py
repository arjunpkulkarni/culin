"""
Layer 2: Restaurant Calibration Engine

This package learns restaurant-specific empirical adjustments to Layer 1 baseline estimates.
"""

from layer2.inference import calibrate, set_model, get_model
from layer2.calibration_model import CalibrationModel
from layer2.feature_extraction import extract_features
from layer2.confidence import confidence_score

__all__ = [
    'calibrate',
    'set_model',
    'get_model',
    'CalibrationModel',
    'extract_features',
    'confidence_score',
]

__version__ = '1.0.0'
