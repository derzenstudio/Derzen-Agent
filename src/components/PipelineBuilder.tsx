import { useState, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Position { x: number; y: number; }
type NodeConfig = Record<string, string | number | boolean>;

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
  created: string;
}

type ViewMode = 'welcome' | 'templates' | 'builder' | 'saved';

// ─── Node Definitions (Plain English) ────────────────────────────────────────
interface NodeTypeDef {
  type: string;
  label: string;
  color: string;
  plainEnglish: string;
  config: NodeConfig;
  configFields: Array<{ key: string; label: string; type: string; placeholder?: string }>;
}

const NODE_TYPES: NodeTypeDef[] = [
  {
    type: 'start',
    label: 'START HERE',
    color: '#2ecc71',
    plainEnglish: 'This is where your pipeline begins. Every pipeline needs one.',
    config: {},
    configFields: [],
  },
  {
    type: 'end',
    label: 'FINISH',
    color: '#e74c3c',
    plainEnglish: 'This is where your pipeline ends. Every pipeline needs one.',
    config: {},
    configFields: [],
  },
  {
    type: 'ai_query',
    label: 'ASK LOCAL AI',
    color: '#9b59b6',
    plainEnglish: 'Send a question to your local AI (Ollama). It runs on your computer, no internet needed.',
    config: { prompt: '' },
    configFields: [
      { key: 'prompt', label: 'What do you want the AI to do?', type: 'textarea', placeholder: 'Example: Summarize this data into 3 bullet points' },
    ],
  },
  {
    type: 'ai_browser',
    label: 'BROWSE ONLINE AI',
    color: '#ec4899',
    plainEnglish: 'Open ChatGPT, Claude, or other AI websites. Type questions, wait for answers, collect results. The AI acts like a human user.',
    config: { 
      ai_service: 'chatgpt',
      prompt: '',
      wait_seconds: 30,
      conversation_mode: false
    },
    configFields: [
      { key: 'ai_service', label: 'Which AI service?', type: 'select', placeholder: 'chatgpt' },
      { key: 'prompt', label: 'What to ask?', type: 'textarea', placeholder: 'Example: Write a poem about technology' },
      { key: 'wait_seconds', label: 'How long to wait for response (seconds)?', type: 'number', placeholder: '30' },
      { key: 'conversation_mode', label: 'Continue existing conversation?', type: 'checkbox', placeholder: 'false' },
    ],
  },
  {
    type: 'web_scrape',
    label: 'READ WEBSITES',
    color: '#3498db',
    plainEnglish: 'Open one or more websites and grab information. You can enter multiple URLs, one per line.',
    config: { urls: '' },
    configFields: [
      { key: 'urls', label: 'Website addresses (one per line)', type: 'textarea', placeholder: 'Example:\nhttps://news.ycombinator.com\nhttps://techcrunch.com\nhttps://arstechnica.com' },
    ],
  },
  {
    type: 'social_analyze',
    label: 'ANALYZE SOCIAL MEDIA',
    color: '#06b6d4',
    plainEnglish: 'Search Twitter, Instagram, LinkedIn, or Facebook for posts about a topic. Analyze sentiment and trends.',
    config: { 
      platform: 'twitter',
      query: '',
      post_count: 10,
      analyze_sentiment: true
    },
    configFields: [
      { key: 'platform', label: 'Which platform?', type: 'select', placeholder: 'twitter' },
      { key: 'query', label: 'What to search for?', type: 'text', placeholder: 'Example: artificial intelligence trends 2026' },
      { key: 'post_count', label: 'How many posts to analyze?', type: 'number', placeholder: '10' },
      { key: 'analyze_sentiment', label: 'Analyze sentiment (positive/negative)?', type: 'checkbox', placeholder: 'true' },
    ],
  },
  {
    type: 'email_send',
    label: 'SEND AN EMAIL',
    color: '#e67e22',
    plainEnglish: 'Send an email to someone. You can use answers from earlier steps in the message.',
    config: { to: '', subject: '', body: '' },
    configFields: [
      { key: 'to', label: 'Send to (email address)', type: 'text', placeholder: 'Example: boss@company.com' },
      { key: 'subject', label: 'Email subject', type: 'text', placeholder: 'Example: Weekly Report' },
      { key: 'body', label: 'Email body', type: 'textarea', placeholder: 'Example: Here is the report: {{ai_answer}}' },
    ],
  },
  {
    type: 'whatsapp_send',
    label: 'SEND A WHATSAPP',
    color: '#27ae60',
    plainEnglish: 'Send a WhatsApp message to someone in your approved contacts list.',
    config: { contact: '', message: '' },
    configFields: [
      { key: 'contact', label: 'Contact name (must be in your approved list)', type: 'text', placeholder: 'Example: Boss' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Example: Report is ready: {{ai_answer}}' },
    ],
  },
  {
    type: 'file_save',
    label: 'SAVE A FILE',
    color: '#7f8c8d',
    plainEnglish: 'Save some text to a file on your computer. It goes in your approved folder.',
    config: { filename: '', content: '' },
    configFields: [
      { key: 'filename', label: 'File name', type: 'text', placeholder: 'Example: report.txt' },
      { key: 'content', label: 'What to save', type: 'textarea', placeholder: 'Example: {{ai_answer}}' },
    ],
  },
  {
    type: 'wait',
    label: 'WAIT',
    color: '#f39c12',
    plainEnglish: 'Pause for a certain number of seconds before continuing.',
    config: { seconds: 5 },
    configFields: [
      { key: 'seconds', label: 'How many seconds to wait?', type: 'number', placeholder: '5' },
    ],
  },
  {
    type: 'branch',
    label: 'MAKE A DECISION',
    color: '#c0392b',
    plainEnglish: 'Check if something is true. If YES, go one way. If NO, go another way.',
    config: { condition: '' },
    configFields: [
      { key: 'condition', label: 'What should be true to go the YES path?', type: 'text', placeholder: 'Example: {{ai_answer}} != ""' },
    ],
  },
];

// ─── Templates (Pre-built pipelines for beginners) ───────────────────────────
const TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  useCase: string;
  nodes: PipelineNode[];
}> = [
  {
    id: 'multi-source-research',
    name: 'Multi-Source Research Report',
    description: 'Scrape multiple websites, let AI analyze all the data, then email the summary.',
    useCase: 'Use this to gather information from multiple sources and create a comprehensive report.',
    nodes: [
      { id: 'n1', type: 'start', position: { x: 100, y: 100 }, config: {}, connections: { next: 'n2' } },
      { id: 'n2', type: 'web_scrape', position: { x: 100, y: 250 }, config: { urls: 'https://news.ycombinator.com\nhttps://techcrunch.com\nhttps://arstechnica.com' }, connections: { next: 'n3' } },
      { id: 'n3', type: 'ai_query', position: { x: 100, y: 400 }, config: { prompt: 'Analyze all these sources and create a comprehensive summary of the top trends' }, connections: { next: 'n4' } },
      { id: 'n4', type: 'email_send', position: { x: 100, y: 550 }, config: { to: 'team@company.com', subject: 'Multi-Source Research Report', body: 'Here are the key findings:\n\n{{ai_answer}}' }, connections: { next: 'n5' } },
      { id: 'n5', type: 'end', position: { x: 100, y: 700 }, config: {}, connections: {} },
    ],
  },
  {
    id: 'ai-browser-comparison',
    name: 'Compare AI Services',
    description: 'Ask the same question to ChatGPT, Claude, and Gemini, then compare their answers.',
    useCase: 'Use this to see how different AI services respond to the same question.',
    nodes: [
      { id: 'n1', type: 'start', position: { x: 100, y: 100 }, config: {}, connections: { next: 'n2' } },
      { id: 'n2', type: 'ai_browser', position: { x: -100, y: 250 }, config: { ai_service: 'chatgpt', prompt: 'Explain quantum computing in simple terms', wait_seconds: 30, conversation_mode: false }, connections: { next: 'n5' } },
      { id: 'n3', type: 'ai_browser', position: { x: 100, y: 250 }, config: { ai_service: 'claude', prompt: 'Explain quantum computing in simple terms', wait_seconds: 30, conversation_mode: false }, connections: { next: 'n5' } },
      { id: 'n4', type: 'ai_browser', position: { x: 300, y: 250 }, config: { ai_service: 'gemini', prompt: 'Explain quantum computing in simple terms', wait_seconds: 30, conversation_mode: false }, connections: { next: 'n5' } },
      { id: 'n5', type: 'ai_query', position: { x: 100, y: 400 }, config: { prompt: 'Compare these three AI responses and explain which one is clearest and why' }, connections: { next: 'n6' } },
      { id: 'n6', type: 'file_save', position: { x: 100, y: 550 }, config: { filename: 'ai_comparison.txt', content: '{{ai_answer}}' }, connections: { next: 'n7' } },
      { id: 'n7', type: 'end', position: { x: 100, y: 700 }, config: {}, connections: {} },
    ],
  },
  {
    id: 'social-media-monitor',
    name: 'Social Media Trend Monitor',
    description: 'Search Twitter for mentions of a topic, analyze sentiment, and alert if negative.',
    useCase: 'Use this to monitor brand reputation or track trending topics.',
    nodes: [
      { id: 'n1', type: 'start', position: { x: 100, y: 100 }, config: {}, connections: { next: 'n2' } },
      { id: 'n2', type: 'social_analyze', position: { x: 100, y: 250 }, config: { platform: 'twitter', query: 'your brand name', post_count: 20, analyze_sentiment: true }, connections: { next: 'n3' } },
      { id: 'n3', type: 'ai_query', position: { x: 100, y: 400 }, config: { prompt: 'Analyze these social media posts. Is the overall sentiment positive or negative? Answer YES if negative, NO if positive.' }, connections: { next: 'n4' } },
      { id: 'n4', type: 'branch', position: { x: 100, y: 550 }, config: { condition: '{{ai_answer}} == "YES"' }, connections: { true: 'n5', false: 'n6' } },
      { id: 'n5', type: 'whatsapp_send', position: { x: -100, y: 700 }, config: { contact: 'Boss', message: 'ALERT: Negative sentiment detected on social media! Check immediately.' }, connections: { next: 'n7' } },
      { id: 'n6', type: 'file_save', position: { x: 300, y: 700 }, config: { filename: 'social_report.txt', content: 'All positive. {{ai_answer}}' }, connections: { next: 'n7' } },
      { id: 'n7', type: 'end', position: { x: 100, y: 850 }, config: {}, connections: {} },
    ],
  },
  {
    id: 'comprehensive-research',
    name: 'Comprehensive Research Pipeline',
    description: 'Scrape websites, analyze social media, use online AI for deep analysis, save report.',
    useCase: 'Use this for in-depth research combining multiple data sources and AI services.',
    nodes: [
      { id: 'n1', type: 'start', position: { x: 100, y: 100 }, config: {}, connections: { next: 'n2' } },
      { id: 'n2', type: 'web_scrape', position: { x: 100, y: 250 }, config: { urls: 'https://industry-news.com\nhttps://research-papers.org' }, connections: { next: 'n3' } },
      { id: 'n3', type: 'social_analyze', position: { x: 100, y: 400 }, config: { platform: 'twitter', query: 'industry trends 2026', post_count: 15, analyze_sentiment: true }, connections: { next: 'n4' } },
      { id: 'n4', type: 'ai_browser', position: { x: 100, y: 550 }, config: { ai_service: 'chatgpt', prompt: 'Based on this web data and social media analysis, provide a comprehensive market research report with actionable insights', wait_seconds: 60, conversation_mode: false }, connections: { next: 'n5' } },
      { id: 'n5', type: 'file_save', position: { x: 100, y: 700 }, config: { filename: 'comprehensive_research.txt', content: '{{ai_answer}}' }, connections: { next: 'n6' } },
      { id: 'n6', type: 'email_send', position: { x: 100, y: 850 }, config: { to: 'stakeholders@company.com', subject: 'Comprehensive Market Research Report', body: '{{ai_answer}}' }, connections: { next: 'n7' } },
      { id: 'n7', type: 'end', position: { x: 100, y: 1000 }, config: {}, connections: {} },
    ],
  },
];

// ─── Example prompts for AI generation ───────────────────────────────────────
const EXAMPLE_PROMPTS = [
  'Scrape 3 tech news sites, analyze with ChatGPT, email the summary',
  'Monitor Twitter for my brand, alert me if sentiment is negative',
  'Compare responses from ChatGPT, Claude, and Gemini on the same question',
  'Read multiple research papers, use online AI for deep analysis, save report',
];

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PipelineBuilder() {
  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>([]);
  const [dragOffset, setDragOffset] = useState<Position | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 });
  const [history, setHistory] = useState<PipelineNode[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showHint, setShowHint] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeIdCounter = useRef(0);

  // ─── History (Undo/Redo) ─────────────────────────────────────────────────
  const pushHistory = useCallback((newNodes: PipelineNode[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newNodes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setNodes(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setNodes(history[historyIndex + 1]);
    }
  };

  // ─── Node Operations ─────────────────────────────────────────────────────
  const addNode = useCallback((type: string, position: Position) => {
    const nodeType = NODE_TYPES.find(n => n.type === type);
    if (!nodeType) return;

    const newNode: PipelineNode = {
      id: `step_${++nodeIdCounter.current}`,
      type,
      position,
      config: { ...nodeType.config },
      connections: {},
    };

    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    pushHistory(newNodes);
    setSelectedNode(newNode.id);
  }, [nodes, pushHistory]);

  const updateNodePosition = useCallback((nodeId: string, position: Position) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, position } : n));
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, key: string, value: string | number | boolean) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    ));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    const newNodes = nodes.filter(n => n.id !== nodeId).map(n => {
      const newConnections = { ...n.connections };
      Object.keys(newConnections).forEach(key => {
        if (newConnections[key] === nodeId) delete newConnections[key];
      });
      return { ...n, connections: newConnections };
    });
    setNodes(newNodes);
    pushHistory(newNodes);
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [nodes, selectedNode, pushHistory]);

  const addConnection = useCallback((fromNodeId: string, fromPort: string, toNodeId: string) => {
    const newNodes = nodes.map(n =>
      n.id === fromNodeId
        ? { ...n, connections: { ...n.connections, [fromPort]: toNodeId } }
        : n
    );
    setNodes(newNodes);
    pushHistory(newNodes);
  }, [nodes, pushHistory]);

  const removeConnection = useCallback((fromNodeId: string, port: string) => {
    const newNodes = nodes.map(n => {
      if (n.id === fromNodeId) {
        const newConnections = { ...n.connections };
        delete newConnections[port];
        return { ...n, connections: newConnections };
      }
      return n;
    });
    setNodes(newNodes);
    pushHistory(newNodes);
  }, [nodes, pushHistory]);

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
        x: Math.max(0, e.clientX - dragOffset.x),
        y: Math.max(0, e.clientY - dragOffset.y),
      };
      updateNodePosition(selectedNode, newPosition);
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragOffset) {
      pushHistory(nodes);
    }
    setDragOffset(null);
  };

  // ─── Connection Drawing ───────────────────────────────────────────────────
  const startConnection = (nodeId: string, port: string) => {
    if (connectingFrom) {
      if (connectingFrom.nodeId !== nodeId) {
        addConnection(connectingFrom.nodeId, connectingFrom.port, nodeId);
      }
      setConnectingFrom(null);
    } else {
      setConnectingFrom({ nodeId, port });
    }
  };

  const getNodePort = (node: PipelineNode, port: string): Position => {
    const baseY = node.position.y + NODE_HEIGHT / 2;
    if (port === 'output' || port === 'next' || port === 'true' || port === 'false') {
      return { x: node.position.x + NODE_WIDTH, y: baseY };
    }
    return { x: node.position.x, y: baseY };
  };

  const renderConnections = () => {
    const lines: JSX.Element[] = [];

    nodes.forEach(node => {
      Object.entries(node.connections).forEach(([port, targetId]) => {
        if (!targetId) return;
        const targetNode = nodes.find(n => n.id === targetId);
        if (!targetNode) return;

        const from = getNodePort(node, port === 'next' ? 'output' : port);
        const to = getNodePort(targetNode, 'input');

        const midX = (from.x + to.x) / 2;
        const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

        const color = port === 'true' ? '#2ecc71' : port === 'false' ? '#e74c3c' : '#a0a0a0';

        lines.push(
          <g key={`${node.id}-${port}-${targetId}`}>
            <path
              d={path}
              stroke="transparent"
              strokeWidth="15"
              fill="none"
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onClick={(e) => { e.stopPropagation(); removeConnection(node.id, port); }}
            />
            <path
              d={path}
              stroke={color}
              strokeWidth="3"
              fill="none"
              markerEnd="url(#arrowhead)"
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      });
    });

    if (connectingFrom) {
      const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
      if (fromNode) {
        const from = getNodePort(fromNode, connectingFrom.port === 'next' ? 'output' : connectingFrom.port);
        const midX = (from.x + mousePos.x) / 2;
        const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;

        lines.push(
          <path
            key="drawing"
            d={path}
            stroke="var(--accent)"
            strokeWidth="3"
            fill="none"
            strokeDasharray="8,4"
          />
        );
      }
    }

    return lines;
  };

  // ─── Pipeline Operations ─────────────────────────────────────────────────
  const clearCanvas = () => {
    if (nodes.length > 0 && !confirm('Clear the canvas? This cannot be undone.')) return;
    setNodes([]);
    setSelectedNode(null);
    setConnectingFrom(null);
    nodeIdCounter.current = 0;
    pushHistory([]);
  };

  const savePipeline = () => {
    if (!pipelineName.trim()) {
      alert('Please give your pipeline a name first.');
      return;
    }
    if (nodes.length === 0) {
      alert('Your pipeline is empty. Add some steps first.');
      return;
    }

    const hasStart = nodes.some(n => n.type === 'start');
    const hasEnd = nodes.some(n => n.type === 'end');
    if (!hasStart || !hasEnd) {
      alert('Every pipeline needs a START HERE step and a FINISH step.');
      return;
    }

    const pipeline: Pipeline = {
      id: `pipeline_${Date.now()}`,
      name: pipelineName,
      description: pipelineDesc,
      nodes,
      created: new Date().toISOString(),
    };

    setSavedPipelines(prev => [...prev, pipeline]);
    alert(`Saved! Your pipeline "${pipelineName}" is ready to run.`);
  };

  const loadTemplate = (template: typeof TEMPLATES[0]) => {
    setNodes(template.nodes.map(n => ({ ...n })));
    setPipelineName(template.name);
    setPipelineDesc(template.description);
    nodeIdCounter.current = template.nodes.length;
    pushHistory(template.nodes);
    setViewMode('builder');
  };

  const loadPipeline = (pipeline: Pipeline) => {
    setNodes(pipeline.nodes);
    setPipelineName(pipeline.name);
    setPipelineDesc(pipeline.description);
    nodeIdCounter.current = pipeline.nodes.length;
    pushHistory(pipeline.nodes);
    setViewMode('builder');
  };

  const generateFromPrompt = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);

    // Simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 1500));

    const prompt = promptInput.toLowerCase();
    const generatedNodes: PipelineNode[] = [];
    let y = 50;
    const spacing = 150;
    let id = 0;

    // Always start with START
    generatedNodes.push({
      id: `step_${++id}`,
      type: 'start',
      position: { x: 300, y },
      config: {},
      connections: {},
    });

    if (prompt.includes('scrape') || prompt.includes('read') || prompt.includes('website') || prompt.includes('check')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'web_scrape',
        position: { x: 300, y },
        config: { urls: 'https://example.com' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('social') || prompt.includes('twitter') || prompt.includes('instagram')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'social_analyze',
        position: { x: 300, y },
        config: { platform: 'twitter', query: 'trending topics', post_count: 10, analyze_sentiment: true },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('chatgpt') || prompt.includes('claude') || prompt.includes('gemini') || prompt.includes('online ai')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'ai_browser',
        position: { x: 300, y },
        config: { ai_service: 'chatgpt', prompt: 'Analyze the data', wait_seconds: 30, conversation_mode: false },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    } else if (prompt.includes('ai') || prompt.includes('ask') || prompt.includes('analyze') || prompt.includes('think') || prompt.includes('summarize')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'ai_query',
        position: { x: 300, y },
        config: { prompt: 'Analyze the data and provide insights' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('if') || prompt.includes('check') || prompt.includes('decide') || prompt.includes('condition')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'branch',
        position: { x: 300, y },
        config: { condition: '{{ai_answer}} != ""' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;

      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'ai_query',
        position: { x: 100, y },
        config: { prompt: 'Generate a detailed response' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.true = generatedNodes[generatedNodes.length - 1].id;

      generatedNodes.push({
        id: `step_${++id}`,
        type: 'wait',
        position: { x: 500, y },
        config: { seconds: 60 },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 3].connections.false = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('email')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'email_send',
        position: { x: 300, y },
        config: { to: 'recipient@example.com', subject: 'Report', body: '{{ai_answer}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('whatsapp') || prompt.includes('message') || prompt.includes('alert')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'whatsapp_send',
        position: { x: 300, y },
        config: { contact: 'Boss', message: '{{ai_answer}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    if (prompt.includes('save') || prompt.includes('file') || prompt.includes('store')) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'file_save',
        position: { x: 300, y },
        config: { filename: 'output.txt', content: '{{ai_answer}}' },
        connections: {},
      });
      generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;
    }

    // Default: if nothing specific matched, add an AI query
    if (generatedNodes.length === 1) {
      y += spacing;
      generatedNodes.push({
        id: `step_${++id}`,
        type: 'ai_query',
        position: { x: 300, y },
        config: { prompt: promptInput },
        connections: {},
      });
      generatedNodes[0].connections.next = generatedNodes[1].id;
    }

    // Always end with END
    y += spacing;
    generatedNodes.push({
      id: `step_${++id}`,
      type: 'end',
      position: { x: 300, y },
      config: {},
      connections: {},
    });
    generatedNodes[generatedNodes.length - 2].connections.next = generatedNodes[generatedNodes.length - 1].id;

    setNodes(generatedNodes);
    nodeIdCounter.current = id;
    setPipelineName(`Pipeline: ${promptInput.slice(0, 40)}`);
    setPipelineDesc(`Generated from: "${promptInput}"`);
    setIsGenerating(false);
    setPromptInput('');
    setViewMode('builder');
    pushHistory(generatedNodes);
  };

  // ─── Render: Welcome Screen ──────────────────────────────────────────────
  if (viewMode === 'welcome') {
    return (
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>DERZEN</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', fontStyle: 'italic' }}>
            Still and always be DERZEN
          </p>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', fontSize: '1.125rem' }}>
          Build powerful automation pipelines visually. No coding required.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          <div
            onClick={() => setViewMode('templates')}
            style={{
              background: 'var(--bg-secondary)',
              border: '2px solid var(--accent)',
              padding: '2.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '0.1em' }}>
              RECOMMENDED FOR BEGINNERS
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Start from a Template</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
              Pick a ready-made pipeline and customize it. Great way to learn how things work.
            </p>
            <div style={{ marginTop: '1.5rem', color: 'var(--accent)', fontWeight: 800 }}>
              CHOOSE A TEMPLATE →
            </div>
          </div>

          <div
            onClick={() => { setViewMode('builder'); clearCanvas(); }}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              padding: '2.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '0.1em' }}>
              FOR THOSE WHO LIKE CONTROL
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Build from Scratch</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
              Start with an empty canvas. Drag and drop steps to build your own pipeline.
            </p>
            <div style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontWeight: 800 }}>
              OPEN CANVAS →
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              padding: '2.5rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '0.1em' }}>
              LET THE AI DO THE WORK
            </div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Describe What You Want</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Tell the AI what your pipeline should do in plain English. It will build it for you.
            </p>
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Example: Scrape 3 tech sites, analyze with ChatGPT, email summary"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
              onKeyDown={(e) => e.key === 'Enter' && generateFromPrompt()}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {EXAMPLE_PROMPTS.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setPromptInput(example)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={generateFromPrompt}
              disabled={isGenerating || !promptInput.trim()}
              style={{ width: '100%', opacity: isGenerating || !promptInput.trim() ? 0.5 : 1 }}
            >
              {isGenerating ? 'AI IS BUILDING YOUR PIPELINE...' : 'LET AI BUILD IT'}
            </button>
          </div>
        </div>

        {/* Saved pipelines quick access */}
        {savedPipelines.length > 0 && (
          <div>
            <h2>YOUR SAVED PIPELINES</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {savedPipelines.map((pipeline) => (
                <div
                  key={pipeline.id}
                  onClick={() => loadPipeline(pipeline)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.5rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{pipeline.name}</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                      {pipeline.nodes.length} steps · Created {new Date(pipeline.created).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ color: 'var(--accent)', fontWeight: 800 }}>OPEN →</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Templates Screen ────────────────────────────────────────────
  if (viewMode === 'templates') {
    return (
      <div>
        <button
          onClick={() => setViewMode('welcome')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginBottom: '1rem',
            padding: 0,
          }}
        >
          ← BACK
        </button>

        <h1>CHOOSE A TEMPLATE</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          These are ready-made pipelines. Pick one, and you can change anything you want.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                transition: 'all 0.3s',
                cursor: 'pointer',
              }}
              onClick={() => loadTemplate(template)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {/* Visual Preview */}
              <div style={{
                height: '180px',
                background: 'var(--bg-primary)',
                padding: '1rem',
                position: 'relative',
                overflow: 'hidden',
                borderBottom: '1px solid var(--border)',
              }}>
                <svg width="100%" height="100%" viewBox="0 0 300 160">
                  {template.nodes.slice(0, 5).map((node, i) => {
                    const nodeType = NODE_TYPES.find(n => n.type === node.type);
                    const x = 30 + (i % 2) * 120;
                    const y = 10 + Math.floor(i / 2) * 50;
                    return (
                      <g key={node.id}>
                        <rect
                          x={x}
                          y={y}
                          width="100"
                          height="35"
                          fill={nodeType?.color || '#666'}
                          rx="4"
                          opacity="0.9"
                        />
                        <text
                          x={x + 50}
                          y={y + 22}
                          textAnchor="middle"
                          fill="white"
                          fontSize="10"
                          fontWeight="800"
                          fontFamily="Poppins"
                        >
                          {nodeType?.label || node.type}
                        </text>
                        {i < template.nodes.length - 1 && i < 4 && (
                          <line
                            x1={x + 50}
                            y1={y + 35}
                            x2={x + 50}
                            y2={y + 50}
                            stroke="#666"
                            strokeWidth="2"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{template.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  {template.description}
                </p>
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Good for:</strong> {template.useCase}
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {template.nodes.length} steps
                  </span>
                  <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.875rem' }}>
                    USE THIS →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Render: Builder Screen ──────────────────────────────────────────────
  const selectedNodeData = nodes.find(n => n.id === selectedNode);
  const selectedNodeType = NODE_TYPES.find(n => n.type === selectedNodeData?.type);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>DERZEN</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Still and always be DERZEN
        </p>
      </div>

      {/* Top Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => setViewMode('welcome')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          ← BACK TO START
        </button>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: historyIndex <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
            }}
          >
            UNDO
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: historyIndex >= history.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
            }}
          >
            REDO
          </button>
          <button
            onClick={clearCanvas}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            CLEAR ALL
          </button>
        </div>
      </div>

      {/* Pipeline Name */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={pipelineName}
          onChange={(e) => setPipelineName(e.target.value)}
          placeholder="Give your pipeline a name..."
          style={{
            flex: 2,
            minWidth: '200px',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '1rem',
          }}
        />
        <input
          type="text"
          value={pipelineDesc}
          onChange={(e) => setPipelineDesc(e.target.value)}
          placeholder="What does this pipeline do? (optional)"
          style={{
            flex: 3,
            minWidth: '200px',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        />
      </div>

      {/* Main Builder Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', gap: '1rem', minHeight: '600px' }}>
        {/* Left: Step Palette */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1rem', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            AVAILABLE STEPS
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Drag a step onto the canvas, or click to add it.
          </p>

          {NODE_TYPES.map((nodeType) => (
            <div
              key={nodeType.type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('nodeType', nodeType.type)}
              onClick={() => {
                const y = 50 + nodes.length * 150;
                addNode(nodeType.type, { x: 300, y });
              }}
              onMouseEnter={() => setShowHint(nodeType.type)}
              onMouseLeave={() => setShowHint(null)}
              style={{
                padding: '1rem',
                marginBottom: '0.5rem',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${nodeType.color}`,
                cursor: 'grab',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.875rem', color: nodeType.color, marginBottom: '0.25rem' }}>
                {nodeType.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {nodeType.plainEnglish.slice(0, 60)}...
              </div>
            </div>
          ))}

          {/* Hint popup */}
          {showHint && (
            <div style={{
              position: 'fixed',
              bottom: '2rem',
              left: '2rem',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent)',
              padding: '1rem',
              maxWidth: '300px',
              zIndex: 100,
            }}>
              <div style={{ fontWeight: 800, fontSize: '0.875rem', marginBottom: '0.5rem', color: NODE_TYPES.find(n => n.type === showHint)?.color }}>
                {NODE_TYPES.find(n => n.type === showHint)?.label}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {NODE_TYPES.find(n => n.type === showHint)?.plainEnglish}
              </div>
            </div>
          )}
        </div>

        {/* Center: Canvas */}
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
            backgroundSize: '25px 25px',
            minHeight: '600px',
          }}
        >
          {/* SVG Connections */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="var(--text-muted)" />
              </marker>
            </defs>
            <g style={{ pointerEvents: 'auto' }}>
              {renderConnections()}
            </g>
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const nodeType = NODE_TYPES.find(n => n.type === node.type);
            if (!nodeType) return null;

            const isSelected = selectedNode === node.id;
            const hasInputConnection = nodes.some(n => Object.values(n.connections).includes(node.id));

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
                  border: `3px solid ${isSelected ? 'var(--accent)' : nodeType.color}`,
                  cursor: dragOffset && selectedNode === node.id ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '0.5rem',
                  boxShadow: isSelected ? '0 0 30px rgba(230, 57, 70, 0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.875rem', color: nodeType.color, textAlign: 'center' }}>
                  {nodeType.label}
                </div>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem', textAlign: 'center' }}>
                  {node.id}
                </div>

                {/* Input Port (left side) */}
                {node.type !== 'start' && (
                  <div
                    onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'input'); }}
                    style={{
                      position: 'absolute',
                      left: -10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: connectingFrom ? 'var(--accent)' : hasInputConnection ? '#2ecc71' : 'var(--bg-tertiary)',
                      border: '3px solid var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title="Click here to connect FROM another step"
                  />
                )}

                {/* Output Ports (right side) */}
                {node.type === 'branch' ? (
                  <>
                    <div
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'true'); }}
                      style={{
                        position: 'absolute',
                        right: -10,
                        top: '30%',
                        transform: 'translateY(-50%)',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#2ecc71',
                        border: '3px solid var(--bg-primary)',
                        cursor: 'pointer',
                      }}
                      title="YES path - connect to the next step if the answer is YES"
                    />
                    <div
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'false'); }}
                      style={{
                        position: 'absolute',
                        right: -10,
                        top: '70%',
                        transform: 'translateY(-50%)',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#e74c3c',
                        border: '3px solid var(--bg-primary)',
                        cursor: 'pointer',
                      }}
                      title="NO path - connect to the next step if the answer is NO"
                    />
                    <div style={{ position: 'absolute', right: -35, top: '30%', transform: 'translateY(-50%)', fontSize: '0.625rem', fontWeight: 800, color: '#2ecc71' }}>YES</div>
                    <div style={{ position: 'absolute', right: -35, top: '70%', transform: 'translateY(-50%)', fontSize: '0.625rem', fontWeight: 800, color: '#e74c3c' }}>NO</div>
                  </>
                ) : node.type !== 'end' ? (
                  <div
                    onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'next'); }}
                    style={{
                      position: 'absolute',
                      right: -10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: connectingFrom ? 'var(--accent)' : node.connections.next ? '#2ecc71' : 'var(--bg-tertiary)',
                      border: '3px solid var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title="Click here, then click the next step to connect them"
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
              maxWidth: '400px',
            }}>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>YOUR PIPELINE STARTS HERE</p>
              <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Drag a step from the left panel, or click it to add it to the canvas.
                Start with a green "START HERE" step.
              </p>
              <button
                onClick={() => addNode('start', { x: 300, y: 100 })}
                className="btn btn-primary"
              >
                ADD START STEP
              </button>
            </div>
          )}
        </div>

        {/* Right: Properties Panel */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '1.5rem', overflowY: 'auto' }}>
          {selectedNodeData && selectedNodeType ? (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                SELECTED STEP
              </div>
              <h3 style={{ fontSize: '1.25rem', color: selectedNodeType.color, marginBottom: '0.5rem' }}>
                {selectedNodeType.label}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                {selectedNodeType.plainEnglish}
              </p>

              <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>STEP ID</div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: '0.875rem', fontWeight: 800 }}>
                  {selectedNodeData.id}
                </div>
              </div>

              {/* Config Fields */}
              {selectedNodeType.configFields.map((field) => (
                <div key={field.key} style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                  }}>
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={String(selectedNodeData.config[field.key] || '')}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, field.key, e.target.value)}
                      rows={4}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={Number(selectedNodeData.config[field.key] || 0)}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, field.key, Number(e.target.value))}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    />
                  ) : field.type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedNodeData.config[field.key])}
                        onChange={(e) => updateNodeConfig(selectedNodeData.id, field.key, e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {field.placeholder === 'true' ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : field.type === 'select' ? (
                    <select
                      value={String(selectedNodeData.config[field.key] || '')}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, field.key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {field.key === 'ai_service' && (
                        <>
                          <option value="chatgpt">ChatGPT</option>
                          <option value="claude">Claude</option>
                          <option value="gemini">Gemini</option>
                          <option value="perplexity">Perplexity</option>
                        </>
                      )}
                      {field.key === 'platform' && (
                        <>
                          <option value="twitter">Twitter / X</option>
                          <option value="instagram">Instagram</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="facebook">Facebook</option>
                        </>
                      )}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(selectedNodeData.config[field.key] || '')}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontFamily: "'Poppins', sans-serif",
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    />
                  )}
                </div>
              ))}

              {/* Connections Info */}
              <div style={{ padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  CONNECTIONS
                </div>
                {Object.entries(selectedNodeData.connections).filter(([, v]) => v).length > 0 ? (
                  Object.entries(selectedNodeData.connections).filter(([, v]) => v).map(([port, targetId]) => (
                    <div key={port} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {port === 'next' ? 'Next step' : port === 'true' ? 'If YES' : port === 'false' ? 'If NO' : port} → {targetId}
                      </span>
                      <button
                        onClick={() => removeConnection(selectedNodeData.id, port)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        REMOVE
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 0 }}>
                    Not connected yet. Click the circle on the right side of this step, then click the circle on the left side of the next step.
                  </p>
                )}
              </div>

              <button
                onClick={() => deleteNode(selectedNodeData.id)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'transparent',
                  border: '2px solid var(--danger)',
                  color: 'var(--danger)',
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                DELETE THIS STEP
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>SELECT A STEP</p>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                Click on any step in the canvas to see its settings here.
              </p>
            </div>
          )}

          {/* How to Connect Help */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              HOW TO CONNECT STEPS
            </div>
            <ol style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', lineHeight: 1.6, marginBottom: 0 }}>
              <li>Click the circle on the RIGHT side of a step</li>
              <li>Then click the circle on the LEFT side of the next step</li>
              <li>A line will appear connecting them</li>
              <li>Click a line to remove it</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {nodes.length} step{nodes.length !== 1 ? 's' : ''} in this pipeline
          {nodes.some(n => n.type === 'start') && nodes.some(n => n.type === 'end') ? (
            <span style={{ color: 'var(--success)', marginLeft: '1rem', fontWeight: 800 }}>READY TO SAVE</span>
          ) : (
            <span style={{ color: 'var(--warning)', marginLeft: '1rem', fontWeight: 800 }}>
              {!nodes.some(n => n.type === 'start') && 'Need START step ' }
              {!nodes.some(n => n.type === 'end') && 'Need FINISH step'}
            </span>
          )}
        </div>
        <button className="btn btn-secondary" onClick={() => alert('Testing pipeline... (demo mode)')}>
          TEST PIPELINE
        </button>
        <button className="btn btn-primary" onClick={savePipeline}>
          SAVE PIPELINE
        </button>
        <button
          className="btn btn-primary"
          onClick={() => alert('Running pipeline... (demo mode)')}
          style={{ background: 'var(--success)' }}
        >
          RUN NOW
        </button>
      </div>
    </div>
  );
}
