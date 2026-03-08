from pydantic_settings import BaseSettings


class AgentConfig(BaseSettings):
    """Agent configuration from environment variables."""

    hub_url: str = "wss://localhost/api/v1/fleet/agent-ws"
    agent_token: str = ""
    bck_manager_path: str = "/opt/bck_manager"
    config_path: str = "/opt/bck_manager/config.yaml"
    reconnect_delay: int = 5
    heartbeat_interval: int = 30

    model_config = {"env_prefix": "BCK_AGENT_"}
