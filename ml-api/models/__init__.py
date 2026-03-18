"""
ML Models Package
"""

from .performance_model import StudentPerformanceAnalyzer

# Backward compatibility alias for older imports.
StudentPerformanceModel = StudentPerformanceAnalyzer

__all__ = ['StudentPerformanceAnalyzer', 'StudentPerformanceModel']
