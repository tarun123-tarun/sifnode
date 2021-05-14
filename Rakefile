require &quot;rake&quot;
require &quot;yaml&quot;
require &quot;digest&quot;
require &quot;rbconfig&quot;

Dir[&quot;**/*.rake&quot;].each do |path|
  Rake.add_rakelib(path&amp;.split(&quot;/&quot;)&amp;.reverse&amp;.drop(1)&amp;.reverse&amp;.join(&quot;/&quot;))
end
