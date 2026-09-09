import { useState, useRef, useCallback, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Position { x: number; y: number; }

type NodeConfig = Record<string, string | number | string[]>;

interface PipelineNode {
  id: string;
  type: string;
  position: Position;
  config: NodeConfig;
  connections: Record<string, string | undefined>;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  nodes: PipelineNode[];
  schedule?: string;
}

// ─── Node Type Definitions ───────────────────────────────────────────────────
const NODE_TYPES: Array<{ type: string; label: string; color: string; description: string; config: NodeConfig }> = [
  { type: 'start', label: 'START', color: '#2ecc71', description: 'Pipeline entry point', config: {} },
  { type: 'end', label: 'END', color: '#e74c3c', description: 'Pipeline exit point', config: {} },
  { type: 'ai_query', label: 'AI QUERY', color: '#9b59b6', description: 'Send prompt to AI model', config: { prompt: '' } },
  { type: 'web_scrape', label: 'WEB SCRAPE', color: '#3498db', description: 'Scrape data from URLs', config: { urls: '' } },
  { type: 'email_send', label: 'EMAIL SEND', color: '#e67e22', description: 'Send email message', config: { to: '', subject: '', body: '' } },
  { type: 'whatsapp_send', label: 'WHATSAPP', color: '#27ae60', description: 'Send WhatsApp message', config: { contact: '', message: '' } },
  { type: 'file_save', label: 'FILE SAVE', color: '#7f8c8d', description: 'Save data to file', config: { filename: '', content: '' } },
  { type: 'wait', label: 'WAIT', color: '#f39c12', description: 'Pause execution', config: { seconds: 5 } },
  { type: 'branch', label: 'BRANCH', color: '#e74c3c', description: 'Conditional logic (true/false paths)', config: { condition: '' } },
];

const NODE_WIDTH = 180;
const NODE_HEIGHT = 80;

// ─── Component ───────────────────────────────────────────────────────────────
export default function PipelineBuilder() {
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>([]);
  const [activeTab, setActiveTab] = useState<'build' | 'saved'>('build');
  const [dragOffset, setDragOffset] = useState<Position | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeIdCounter = useRef(0);

  // ─── Node Operations ─────────────────────────────────────────────────────
  const addNode = useCallback((type: string, position: Position) => {
    const nodeType = NODE_TYPES.find(n => n.type === type);
    if (!nodeType) return;

    const newNode: PipelineNode = {
      id: `node_${++nodeIdCounter.current}`,
      type,
      position,
      config: { ...nodeType.config },
      connections: {},
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNode(newNode.id);
  }, []);

  const updateNodePosition = useCallback((nodeId: string, position: Position) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position } : n));
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, key: string, value: string | number) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    ));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    // Remove connections to this node
    setNodes(prev => prev.map(n => {
      const newConnections = { ...n.connections };
      Object.keys(newConnections).forEach(key => {
        if (newConnections[key] === nodeId) delete newConnections[key];
      });
      return { ...n, connections: newConnections };
    }));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [selectedNode]);

  const addConnection = useCallback((fromNodeId: string, fromPort: string, toNodeId: string) => {
    setNodes(prev => prev.map(n =>
      n.id === fromNodeId
        ? { ...n, connections: { ...n.connections, [fromPort]: toNodeId } }
        : n
    ));
  }, []);

  // ─── Drag and Drop ───────────────────────────────────────────────────────
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType');
    if (!type || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const position = {
      x: e.clientX - rect.left - NODE_WIDTH / 2,
      y: e.clientY - rect.top - NODE_HEIGHT / 2,
    };

    addNode(type, position);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
    setSelectedNode(nodeId);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (dragOffset && selectedNode) {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      };
      updateNodePosition(selectedNode, newPosition);
    }
  };

  const handleCanvasMouseUp = () => {
    setDragOffset(null);
  };

  // ─── Connection Drawing ───────────────────────────────────────────────────
  const startConnection = (nodeId: string, port: string) => {
    if (connectingFrom) {
      // Complete connection
      if (connectingFrom.nodeId !== nodeId) {
        addConnection(connectingFrom.nodeId, connectingFrom.port, nodeId);
      }
      setConnectingFrom(null);
    } else {
      setConnectingFrom({ nodeId, port });
    }
  };

  const getNodeCenter = (node: PipelineNode, port?: string): Position => {
    const baseX = node.position.x + NODE_WIDTH / 2;
    const baseY = node.position.y + NODE_HEIGHT / 2;

    if (port === 'output' || port === 'next' || port === 'true' || port === 'false') {
      return { x: node.position.x + NODE_WIDTH, y: baseY };
    }
    if (port === 'input') {
      return { x: node.position.x, y: baseY };
    }
    return { x: baseX, y: baseY };
  };

  const renderConnections = () => {
    const lines: JSX.Element[] = [];

    nodes.forEach(node => {
      Object.entries(node.connections).forEach(([port, targetId]) => {
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) return;

        const from = getNodeCenter(node, port === 'next' ? 'output' : port);
        const to = getNodeCenter(targetNode, 'input');

        // Create curved path
        const midX = (from.x + to.x) / 2;
        const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

        const color = port === 'true' ? '#2ecc71' : port === 'false' ? '#e74c3c' : '#a0a0a0';

        lines.push(
          <path
            key={`${node.id}-${port}-${targetId}`}
            d={path}
            stroke={color}
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });

    // Drawing line in progress
    if (connectingFrom) {
      const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
      if (fromNode) {
        const from = getNodeCenter(fromNode, connectingFrom.port === 'next' ? 'output' : connectingFrom.port);
        const midX = (from.x + mousePos.x) / 2;
        const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;

        lines.push(
          <path
            key="drawing"
            d={path}
            stroke="var(--accent)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="5,5"
          />
        );
      }
    }

    return lines;
  };

  // ─── Pipeline Operations ─────────────────────────────────────────────────
  const clearCanvas = () => {
    setNodes([]);
    setSelectedNode(null);
    setConnectingFrom(null);
    nodeIdCounter.current = 0;
  };

  const savePipeline = () => {
    if (!pipelineName.trim()) {
      alert('Please enter a pipeline name');
      return;
    }

    const pipeline: Pipeline = {
      id: `pipeline_${Date.now()}`,
      name: pipelineName,
      description: pipelineDesc,
      nodes,
    };

    setSavedPipelines(prev => [...prev, pipeline]);
    // In real app, would POST to /api/pipelines
    alert(`Pipeline "${pipelineName}" saved! (${nodes.length} nodes)`);
  };

  const loadPipeline = (pipeline: Pipeline) => {
    setNodes(pipeline.nodes);
    setPipelineName(pipeline.name);
    setPipelineDesc(pipeline.description);
    setActiveTab('build');
  };

  const generateFromPrompt = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);

    // Simulate AI generation (in real app, POST to /api/pipelines/generate)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate a sample pipeline based on prompt keywords
    const prompt = promptInput.toLowerCase();
    const generatedNodes: PipelineNode[] = [];
    let y = 50;
    const spacing = 120;
    let id = 0;

    // Always start with START
    generatedNodes.push({
      id: `node_${++id}`,
      type: 'start',
      position: { x: 300, y },
      config: {},
      connections: {},
    });

    if (prompt.includes('scrape') || prompt.includes('web') || prompt.includes('research')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'web_scrape',
        position: { x: 300, y },
        config: { urls: 'https://example.com' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('ai') || prompt.includes('analyze') || prompt.includes('process')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'ai_query',
        position: { x: 300, y },
        config: { prompt: 'Analyze the data and provide insights' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('branch') || prompt.includes('if') || prompt.includes('condition')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'branch',
        position: { x: 300, y },
        config: { condition: '{{response}} != ""' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;

      // True branch
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'ai_query',
        position: { x: 150, y },
        config: { prompt: 'Generate summary' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.true = generatedNodes[generatedNodes.length - 1].id;

      // False branch
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'wait',
        position: { x: 450, y },
        config: { seconds: 10 },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 3].connections.false = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('email') || prompt.includes('send')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'email_send',
        position: { x: 300, y },
        config: { to: '{{recipient}}', subject: 'Report', body: '{{summary}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('whatsapp') || prompt.includes('message')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'whatsapp_send',
        position: { x: 300, y },
        config: { contact: 'Team', message: '{{summary}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('save') || prompt.includes('file')) {
      y += spacing;
      generatedNodes.push({
        id: `node_${++id}`,
        type: 'file_save',
        position: { x: 300, y },
        config: { filename: 'output.txt', content: '{{result}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    // Always end with END
    y += spacing;
    generatedNodes.push({
      id: `node_${++id}`,
      type: 'end',
      position: { x: 300, y },
      config: {},
      connections: {},
    });
    generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;

    setNodes(generatedNodes);
    nodeIdCounter.current = id;
    setPipelineName(`AI Generated: ${promptInput.slice(0, 30)}...`);
    setIsGenerating(false);
    setPromptInput('');
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);
  const selectedNodeType = NODE_TYPES.find(n => n.type === selectedNodeData?.type);

  return (
    <div>
      <h1>PIPELINE BUILDER</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Create automation pipelines visually. Drag nodes, connect them, and run.
      </p>

      {/* Prompt Input */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.875rem', marginBottom: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          DESCRIBE YOUR PIPELINE
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="e.g., Scrape news sites, analyze with AI, if results found send email, else wait and retry"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
            onKeyDown={(e) => e.key === 'Enter' && generateFromPrompt()}
          />
          <button
            className="btn btn-primary"
            onClick={generateFromPrompt}
            disabled={isGenerating}
            style={{ opacity: isGenerating ? 0.5 : 1 }}
          >
            {isGenerating ? 'GENERATING...' : 'GENERATE'}
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: 0 }}>
          Describe what you want in plain English. AI will create the pipeline structure for you.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('build')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'build' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border)',
            borderBottom: activeTab === 'build' ? 'none' : '1px solid var(--border)',
            color: activeTab === 'build' ? 'var(--accent)' : 'var(--text-secondary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          BUILD
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'saved' ? 'var(--bg-secondary)' : 'transparent',
            border: '1px solid var(--border)',
            borderBottom: activeTab === 'saved' ? 'none' : '1px solid var(--border)',
            color: activeTab === 'saved' ? 'var(--accent)' : 'var(--text-secondary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          SAVED ({savedPipelines.length})
        </button>
      </div>

      {activeTab === 'build' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 280px', gap: '1rem', minHeight: '600px' }}>
          {/* Node Palette */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '0.75rem', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              NODES
            </h3>
            {NODE_TYPES.map((nodeType) => (
              <div
                key={nodeType.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('nodeType', nodeType.type)}
                style={{
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${nodeType.color}`,
                  cursor: 'grab',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = nodeType.color}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  {nodeType.label}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                  {nodeType.description}
                </div>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={() => { setSelectedNode(null); setConnectingFrom(null); }}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {/* SVG Connections */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <polygon points="0 0, 10 3, 0 6" fill="var(--text-muted)" />
                </marker>
              </defs>
              {renderConnections()}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const nodeType = NODE_TYPES.find(n => n.type === node.type);
              if (!nodeType) return null;

              const isSelected = selectedNode === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{
                    position: 'absolute',
                    left: node.position.x,
                    top: node.position.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    background: 'var(--bg-secondary)',
                    border: `2px solid ${isSelected ? 'var(--accent)' : nodeType.color}`,
                    cursor: dragOffset && selectedNode === node.id ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: isSelected ? '0 0 20px rgba(230, 57, 70, 0.3)' : 'none',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', color: nodeType.color }}>
                    {nodeType.label}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {node.id}
                  </div>

                  {/* Input Port */}
                  {node.type !== 'start' && (
                    <div
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'input'); }}
                      style={{
                        position: 'absolute',
                        left: -6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: connectingFrom ? 'var(--accent)' : 'var(--text-muted)',
                        border: '2px solid var(--bg-primary)',
                        cursor: 'pointer',
                      }}
                      title="Connect input"
                    />
                  )}

                  {/* Output Ports */}
                  {node.type === 'branch' ? (
                    <>
                      <div
                        onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'true'); }}
                        style={{
                          position: 'absolute',
                          right: -6,
                          top: '30%',
                          transform: 'translateY(-50%)',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#2ecc71',
                          border: '2px solid var(--bg-primary)',
                          cursor: 'pointer',
                        }}
                        title="True path"
                      />
                      <div
                        onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'false'); }}
                        style={{
                          position: 'absolute',
                          right: -6,
                          top: '70%',
                          transform: 'translateY(-50%)',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: '#e74c3c',
                          border: '2px solid var(--bg-primary)',
                          cursor: 'pointer',
                        }}
                        title="False path"
                      />
                    </>
                  ) : node.type !== 'end' ? (
                    <div
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'next'); }}
                      style={{
                        position: 'absolute',
                        right: -6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: connectingFrom ? 'var(--accent)' : 'var(--text-muted)',
                        border: '2px solid var(--bg-primary)',
                        cursor: 'pointer',
                      }}
                      title="Connect output"
                    />
                  ) : null}
                </div>
              );
            })}

            {/* Empty State */}
            {nodes.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}>
                <p style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>DRAG NODES HERE</p>
                <p style={{ fontSize: '0.75rem' }}>Or use the prompt above to generate a pipeline</p>
              </div>
            )}
          </div>

          {/* Properties Panel */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem', overflowY: 'auto' }}>
            {selectedNodeData && selectedNodeType ? (
              <>
                <h3 style={{ fontSize: '0.75rem', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  NODE PROPERTIES
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    TYPE
                  </label>
                  <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', fontWeight: 800, fontSize: '0.875rem', color: selectedNodeType.color }}>
                    {selectedNodeType.label}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    ID
                  </label>
                  <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', fontFamily: "'Courier New', monospace", fontSize: '0.75rem' }}>
                    {selectedNodeData.id}
                  </div>
                </div>

                {/* Config Fields */}
                {Object.entries(selectedNodeData.config).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                      {key}
                    </label>
                    {typeof value === 'number' ? (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, key, Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      />
                    ) : (
                      <textarea
                        value={String(value)}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, key, e.target.value)}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontFamily: "'Poppins', sans-serif",
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          resize: 'vertical',
                        }}
                        placeholder={`Enter ${key}... Use {'{{'}variable{{'}}'} for dynamic values`}
                      />
                    )}
                  </div>
                ))}

                {/* Connections */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    CONNECTIONS
                  </label>
                  {Object.entries(selectedNodeData.connections).length > 0 ? (
                    Object.entries(selectedNodeData.connections).map(([port, targetId]) => (
                      <div key={port} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        {port} → {targetId}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      No connections. Click output port to connect.
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => deleteNode(selectedNodeData.id)}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  DELETE NODE
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '2rem' }}>
                <p style={{ fontSize: '0.875rem' }}>SELECT A NODE</p>
                <p style={{ fontSize: '0.75rem' }}>Click a node to view its properties</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Saved Pipelines Tab */
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem' }}>
          {savedPipelines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>NO SAVED PIPELINES</p>
              <p style={{ fontSize: '0.875rem' }}>Build and save a pipeline to see it here</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {savedPipelines.map((pipeline) => (
                <div key={pipeline.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{pipeline.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                      {pipeline.nodes.length} nodes · {pipeline.description || 'No description'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" onClick={() => loadPipeline(pipeline)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                      LOAD
                    </button>
                    <button className="btn btn-primary" onClick={() => alert(`Pipeline "${pipeline.name}" started!`)} style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                      RUN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
        <input
          type="text"
          value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
          placeholder="Pipeline name..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        />
        <input
          type="text"
          value={pipelineDesc}
          onChange={(e) => setPipelineDesc(e.target.value)}
          placeholder="Description (optional)..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        />
        <button className="btn btn-secondary" onClick={clearCanvas}>CLEAR</button>
        <button className="btn btn-primary" onClick={savePipeline}>SAVE</button>
        <button className="btn btn-primary" onClick={() => alert(`Running pipeline with ${nodes.length} nodes...`)} style={{ background: 'var(--success)' }}>
          RUN
        </button>
      </div>

      {/* Instructions */}
      <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>HOW TO USE</p>
        <ul style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginBottom: 0 }}>
          <li>Drag nodes from the left palette onto the canvas</li>
          <li>Click output ports (right side) then input ports (left side) to connect nodes</li>
          <li>Branch nodes have two outputs: green (true) and red (false)</li>
          <li>Select a node to edit its configuration in the right panel</li>
          <li>Use {'{{'}variable{'}'}{'}'} syntax in config fields for dynamic values from previous nodes</li>
          <li>Enter a description in the prompt box to auto-generate a pipeline structure</li>
        </ul>
      </div>
    </div>
  );
}
