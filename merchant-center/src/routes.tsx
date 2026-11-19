import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import Calendar from './components/calendar';
import Heatmap from './components/heatmap';
import Locations from './components/locations';
import Matrix from './components/matrix';

const ApplicationRoutes = () => {
  const match = useRouteMatch();
  return (
    <Spacings.Inset scale="l">
      <Switch>
        <Route path={`${match.path}/locations`}>
          <Locations basePath={match.url} />
        </Route>
        <Route path={`${match.path}/calendar`}>
          <Calendar />
        </Route>
        <Route path={`${match.path}/heatmap`}>
          <Heatmap basePath={match.url} />
        </Route>
        <Route path={`${match.path}/matrix`}>
          <Matrix />
        </Route>
        <Route>
          <Redirect to={`${match.url}/locations`} />
        </Route>
      </Switch>
    </Spacings.Inset>
  );
};
ApplicationRoutes.displayName = 'ApplicationRoutes';
export default ApplicationRoutes;
