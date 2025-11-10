/**
 * PaaS Marketplace Page
 * Browse and deploy templates from the marketplace
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, Star, Download, ArrowRight, Filter, Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  icon_url?: string;
  git_url: string;
  buildpack: string;
  recommended_plan_slug: string;
  deploy_count: number;
  rating: number;
  is_featured: boolean;
}

const categoryIcons: Record<string, string> = {
  nodejs: '🟢',
  python: '🐍',
  php: '🐘',
  cms: '📝',
  frontend: '⚛️',
  'full-stack': '🔥',
  golang: '🔷',
  database: '🗄️',
};

const categoryLabels: Record<string, string> = {
  nodejs: 'Node.js',
  python: 'Python',
  php: 'PHP',
  cms: 'CMS',
  frontend: 'Frontend',
  'full-stack': 'Full-Stack',
  golang: 'Go',
  database: 'Database',
};

const PaaSMarketplace: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, search, categoryFilter, featuredOnly]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get('/paas/marketplace/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      toast.error('Failed to load marketplace templates');
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    if (featuredOnly) {
      filtered = filtered.filter((t) => t.is_featured);
    }

    setFilteredTemplates(filtered);
  };

  const handleDeploy = (slug: string) => {
    navigate(`/paas/marketplace/deploy/${slug}`);
  };

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const featuredTemplates = templates.filter((t) => t.is_featured);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-8 h-8" />
          <h1 className="text-3xl font-bold">PaaS Marketplace</h1>
        </div>
        <p className="text-muted-foreground">
          Deploy popular frameworks and applications with one click
        </p>
      </div>

      {/* Featured Templates */}
      {featuredTemplates.length > 0 && !search && categoryFilter === 'all' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Featured Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredTemplates.slice(0, 6).map((template) => (
              <Card key={template.id} className="border-2 border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{categoryIcons[template.category] || '📦'}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {categoryLabels[template.category] || template.category}
                        </Badge>
                      </div>
                    </div>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <CardDescription className="line-clamp-2">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="w-4 h-4" />
                        {template.deploy_count}
                      </span>
                    </div>
                    <Button size="sm" onClick={() => handleDeploy(template.slug)}>
                      Deploy
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {categoryIcons[cat] || ''} {categoryLabels[cat] || cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={featuredOnly ? 'default' : 'outline'}
          onClick={() => setFeaturedOnly(!featuredOnly)}
        >
          <Star className="w-4 h-4 mr-2" />
          Featured Only
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all" onClick={() => setCategoryFilter('all')}>
            All Templates
          </TabsTrigger>
          {categories.map((cat) => (
            <TabsTrigger key={cat} value={cat} onClick={() => setCategoryFilter(cat)}>
              {categoryIcons[cat] || ''} {categoryLabels[cat] || cat}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="py-12">
          <CardContent>
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No templates found</p>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters
              </p>
              <Button variant="outline" onClick={() => { setSearch(''); setCategoryFilter('all'); setFeaturedOnly(false); }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryIcons[template.category] || '📦'}</span>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {categoryLabels[template.category] || template.category}
                      </Badge>
                    </div>
                  </div>
                  {template.is_featured && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <CardDescription className="line-clamp-2">{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4" />
                      {template.deploy_count}
                    </span>
                    {template.buildpack && (
                      <Badge variant="secondary" className="text-xs">
                        {template.buildpack.split('/')[1]}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" onClick={() => handleDeploy(template.slug)}>
                    Deploy
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results Count */}
      {!loading && filteredTemplates.length > 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>
      )}
    </div>
  );
};

export default PaaSMarketplace;
