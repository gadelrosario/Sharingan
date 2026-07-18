"""scripts package initializer for Draft Lab

Mark the `scripts` directory as a package so imports like
`from scripts.simulation_engine import SimulationEngine` work
during test discovery and other package-style imports.
"""
__all__ = [
    'simulation_engine',
    'ai_managers',
    'roster_scoring',
]
